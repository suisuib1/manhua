const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_generation_task_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'
delete process.env.OPENAI_API_KEY

const { clearCoreTables, prisma } = require('./helpers/testDatabase')
const { app } = require('../src/app')
const {
  markStaleGenerationTasksFailed,
} = require('../src/services/generationTask.service')

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server))
    server.on('error', reject)
  })
}

async function requestJson(server, method, path, body, token) {
  const { port } = server.address()
  const headers = {
    'content-type': 'application/json',
  }

  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return {
    response,
    body: await response.json(),
  }
}

async function login(server, code) {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
    profile: {
      nickname: `${code}_user`,
    },
  })

  return body.data
}

function waitForTick() {
  return new Promise((resolve) => setImmediate(resolve))
}

async function waitForTaskStatus(server, taskId, token, expectedStatus, maxAttempts = 20) {
  let detail

  for (let index = 0; index < maxAttempts; index += 1) {
    detail = await requestJson(server, 'GET', `/api/generation-tasks/${taskId}`, undefined, token)

    if (detail.body.data && detail.body.data.status === expectedStatus) {
      return detail
    }

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  return detail
}

async function createDiaryEntry(ownerUserId, suffix = 'one', overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `generation_task_${suffix}_chapter`,
      diaryDate: new Date('2026-05-21T00:00:00.000Z'),
      diaryText: `generation_task_${suffix}_diary_text`,
      pageCount: 3,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['daily', 'cute']),
      status: 'draft',
    }, overrides),
  })
}

async function createStoredGenerationTask(ownerUserId, diaryEntryId, suffix = 'stored', overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-21T00:00:00.000Z')

  return prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId,
      status: overrides.status || 'processing',
      taskType: 'diary_to_comic',
      promptSnapshot: `stored_prompt_${suffix}`,
      inputJson: JSON.stringify({ suffix }),
      resultJson: Object.prototype.hasOwnProperty.call(overrides, 'resultJson')
        ? overrides.resultJson
        : null,
      errorMessage: overrides.errorMessage || null,
      startedAt: Object.prototype.hasOwnProperty.call(overrides, 'startedAt')
        ? overrides.startedAt
        : createdAt,
      finishedAt: Object.prototype.hasOwnProperty.call(overrides, 'finishedAt')
        ? overrides.finishedAt
        : null,
      createdAt,
      updatedAt: overrides.updatedAt || createdAt,
    },
  })
}

async function createCharacterProfile(ownerUserId, suffix = 'one') {
  return prisma.characterProfile.create({
    data: {
      ownerUserId,
      nickname: `小满_${suffix}`,
      roleTitle: `默认漫画书主角_${suffix}`,
      description: `喜欢暖色外套_${suffix}`,
      personalityText: `温柔 好奇_${suffix}`,
      appearanceText: `短发 发夹_${suffix}`,
    },
  })
}

function createOpenAiMockServer(handler) {
  const http = require('node:http')

  return new Promise((resolve, reject) => {
    const calls = []
    const sockets = new Set()
    const server = http.createServer(async (req, res) => {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', async () => {
        const parsedBody = body ? JSON.parse(body) : null
        const call = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: parsedBody,
        }
        calls.push(call)

        try {
          await handler(req, res, call)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: { message: error.message } }))
        }
      })
    })

    server.listen(0, () => {
      const { port } = server.address()
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        calls,
        close: () => new Promise((done) => {
          for (const socket of sockets) {
            socket.destroy()
          }
          server.close(done)
        }),
      })
    })
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => {
        sockets.delete(socket)
      })
    })
    server.on('error', reject)
  })
}

function setOpenAiEnv(values = {}) {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    OPENAI_IMAGE_SIZE: process.env.OPENAI_IMAGE_SIZE,
    OPENAI_IMAGE_QUALITY: process.env.OPENAI_IMAGE_QUALITY,
    OPENAI_IMAGE_STYLE: process.env.OPENAI_IMAGE_STYLE,
    OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
  }

  for (const key of Object.keys(previous)) {
    delete process.env[key]
  }

  Object.assign(process.env, values)

  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test.beforeEach(async () => {
  await clearCoreTables()
  delete process.env.OPENAI_API_KEY
  delete process.env.OPENAI_BASE_URL
  delete process.env.OPENAI_IMAGE_MODEL
  delete process.env.OPENAI_IMAGE_SIZE
  delete process.env.OPENAI_IMAGE_QUALITY
  delete process.env.OPENAI_IMAGE_STYLE
  delete process.env.OPENAI_TIMEOUT_MS
})

test('POST /api/generation-tasks requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: 'diary-entry-id',
    })

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('markStaleGenerationTasksFailed marks timed out processing and pending tasks failed only when safe', async () => {
  const owner = await prisma.user.create({
    data: {
      wxOpenid: 'stale_generation_owner',
    },
  })
  const oldEntry = await createDiaryEntry(owner.id, 'stale_old')
  const freshEntry = await createDiaryEntry(owner.id, 'stale_fresh')
  const oldTime = new Date('2026-05-21T00:00:00.000Z')
  const freshTime = new Date('2026-05-21T00:15:00.000Z')
  const now = new Date('2026-05-21T00:20:00.000Z')

  const staleProcessing = await createStoredGenerationTask(owner.id, oldEntry.id, 'processing', {
    status: 'processing',
    startedAt: oldTime,
    updatedAt: oldTime,
  })
  const stalePending = await createStoredGenerationTask(owner.id, oldEntry.id, 'pending', {
    status: 'pending',
    startedAt: null,
    createdAt: oldTime,
    updatedAt: oldTime,
  })
  const freshProcessing = await createStoredGenerationTask(owner.id, freshEntry.id, 'fresh_processing', {
    status: 'processing',
    startedAt: freshTime,
    updatedAt: freshTime,
  })
  const completed = await createStoredGenerationTask(owner.id, oldEntry.id, 'completed', {
    status: 'completed',
    resultJson: JSON.stringify({ pages: [{ imageUrl: '/uploads/generated/completed.png' }] }),
    finishedAt: oldTime,
    updatedAt: oldTime,
  })
  const failed = await createStoredGenerationTask(owner.id, oldEntry.id, 'failed', {
    status: 'failed',
    errorMessage: 'already failed',
    finishedAt: oldTime,
    updatedAt: oldTime,
  })

  const result = await markStaleGenerationTasksFailed({
    now,
    timeoutMs: 5 * 60 * 1000,
  })

  assert.equal(result.failedCount, 2)

  const storedTasks = await prisma.generationTask.findMany({
    where: {
      id: {
        in: [staleProcessing.id, stalePending.id, freshProcessing.id, completed.id, failed.id],
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })
  const byId = new Map(storedTasks.map((task) => [task.id, task]))

  assert.equal(byId.get(staleProcessing.id).status, 'failed')
  assert.equal(byId.get(staleProcessing.id).errorMessage, '生成任务超时，请重新生成')
  assert.deepEqual(byId.get(staleProcessing.id).finishedAt, now)
  assert.equal(byId.get(stalePending.id).status, 'failed')
  assert.equal(byId.get(stalePending.id).errorMessage, '生成任务超时，请重新生成')
  assert.deepEqual(byId.get(stalePending.id).finishedAt, now)
  assert.equal(byId.get(freshProcessing.id).status, 'processing')
  assert.equal(byId.get(freshProcessing.id).finishedAt, null)
  assert.equal(byId.get(completed.id).status, 'completed')
  assert.deepEqual(byId.get(completed.id).finishedAt, oldTime)
  assert.equal(byId.get(failed.id).status, 'failed')
  assert.equal(byId.get(failed.id).errorMessage, 'already failed')
})

test('logged in user can create and read a completed mock generation task', async () => {
  const server = await listen(app)
  const originalWarn = console.warn
  const warnCalls = []
  console.warn = (...args) => {
    warnCalls.push(args)
  }

  try {
    const loginData = await login(server, 'generation_task_owner')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'owned')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'completed')
    assert.equal(created.body.data.taskType, 'diary_to_comic')
    assert.equal(created.body.data.diaryEntryId, diaryEntry.id)
    assert.equal(created.body.data.ownerUserId, undefined)
    assert.equal(created.body.data.input.diaryEntryId, diaryEntry.id)
    assert.equal(created.body.data.input.chapterTitle, 'generation_task_owned_chapter')
    assert.equal(Array.isArray(created.body.data.result.pages), true)
    assert.equal(created.body.data.result.pages.length, 1)
    assert.equal(created.body.data.result.pages[0].mock, true)
    assert.equal(created.body.data.result.chapter.source, 'mock')
    assert.equal(created.body.data.errorMessage, null)
    assert.equal(warnCalls.length, 0)

    const foundTask = await prisma.generationTask.findUnique({
      where: {
        id: created.body.data.id,
      },
    })
    assert.equal(foundTask.ownerUserId, loginData.user.id)
    assert.equal(foundTask.status, 'completed')
    assert.equal(foundTask.errorMessage, null)

    const detail = await requestJson(server, 'GET', `/api/generation-tasks/${created.body.data.id}`, undefined, loginData.token)

    assert.equal(detail.response.status, 200)
    assert.deepEqual(detail.body.data, created.body.data)
  } finally {
    console.warn = originalWarn
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/generation-tasks returns first OpenAI image when configured', async () => {
  const originalInfo = console.info
  const infoCalls = []
  console.info = (...args) => {
    infoCalls.push(args)
  }
  const mockImage = Buffer.from('mock png bytes')
  const openAiServer = await createOpenAiMockServer(async (req, res, call) => {
    if (req.url === '/v1/images/generations') {
      assert.equal(call.headers.authorization, 'Bearer test-openai-key')
      assert.equal(call.body.model, 'gpt-image-1')
      assert.equal(call.body.size, '1024x1024')
      assert.equal(call.body.prompt.includes('generation_task_openai_chapter'), true)
      assert.equal(call.body.prompt.includes('generation_task_openai_diary_text'), true)
      assert.equal(call.body.prompt.includes('小满_openai'), true)
      assert.equal(call.body.prompt.includes('Q 版'), true)
      assert.equal(call.body.prompt.includes('chibi'), true)
      assert.equal(call.body.prompt.includes('温暖治愈'), true)
      assert.equal(call.body.prompt.includes('单页漫画'), true)
      assert.equal(call.body.prompt.includes('3-4 个清晰分镜'), true)
      assert.equal(call.body.prompt.includes('不要水印'), true)
      assert.equal(call.body.prompt.includes('不要真实照片风'), true)
      assert.equal(call.body.prompt.includes('温柔 好奇_openai'), true)
      assert.equal(call.body.prompt.includes('短发 发夹_openai'), true)

      await new Promise((resolve) => setTimeout(resolve, 50))
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        data: [
          {
            b64_json: mockImage.toString('base64'),
            revised_prompt: 'revised prompt',
          },
        ],
      }))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })
  const restoreEnv = setOpenAiEnv({
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: openAiServer.baseUrl,
  })
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_openai_owner')
    await createCharacterProfile(loginData.user.id, 'openai')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'openai')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'pending')
    assert.deepEqual(created.body.data.result, {})
    assert.equal(created.body.data.startedAt, null)
    assert.equal(created.body.data.finishedAt, null)
    assert.equal(openAiServer.calls.length, 0)

    const processing = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'processing')
    assert.equal(processing.response.status, 200)

    const detail = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'completed')
    assert.equal(detail.response.status, 200)
    assert.equal(detail.body.data.result.chapter.source, 'openai')
    assert.equal(detail.body.data.result.pages[0].mock, false)
    assert.equal(detail.body.data.result.pages[0].imageUrl.startsWith('/uploads/generated/'), true)
    assert.equal(detail.body.data.result.pages[0].caption, '根据日记内容生成的第一页漫画')
    assert.equal(JSON.stringify(created.body.data).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(detail.body.data).includes('b64_json'), false)
    assert.equal(openAiServer.calls.length, 1)
    const imageReadyCall = infoCalls.find((call) => call[0] === '[generation-task]' && call[1].event === 'image-ready')
    assert.notEqual(imageReadyCall, undefined)
    assert.equal(imageReadyCall[1].taskId, created.body.data.id)
    assert.equal(imageReadyCall[1].imageUrl, detail.body.data.result.pages[0].imageUrl)
  } finally {
    console.info = originalInfo
    await new Promise((resolve) => server.close(resolve))
    await openAiServer.close()
    restoreEnv()
  }
})

test('POST /api/generation-tasks falls back when OpenAI fails', async () => {
  const originalWarn = console.warn
  const warnCalls = []
  console.warn = (...args) => {
    warnCalls.push(args)
  }
  const openAiServer = await createOpenAiMockServer((req, res) => {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: { message: 'provider failed' } }))
  })
  const restoreEnv = setOpenAiEnv({
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: openAiServer.baseUrl,
  })
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_openai_fallback')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'provider_failed')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'pending')

    const detail = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'failed')
    assert.equal(detail.response.status, 200)
    assert.equal(detail.body.data.status, 'failed')
    assert.equal(detail.body.data.result && Object.keys(detail.body.data.result).length, 0)
    assert.notEqual(detail.body.data.errorMessage, null)
    assert.equal(detail.body.data.errorMessage.includes('name='), true)
    assert.equal(detail.body.data.errorMessage.includes('message=OpenAI image generation failed with status 500'), true)
    assert.equal(detail.body.data.errorMessage.includes('test-openai-key'), false)
    assert.equal(detail.body.data.errorMessage.includes('Authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('prompt'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_provider_failed_chapter'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_provider_failed_diary_text'), false)
    assert.equal(warnCalls.length, 1)
    assert.equal(warnCalls[0][0], '[generation-task-openai-fallback]')
    assert.equal(warnCalls[0][1].name, 'Error')
    assert.equal(warnCalls[0][1].message, 'OpenAI image generation failed with status 500')
    assert.equal(warnCalls[0][1].model, 'gpt-image-1')
    assert.equal(warnCalls[0][1].size, '1024x1024')
    assert.equal(JSON.stringify(warnCalls).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(warnCalls).includes('Authorization'), false)
  } finally {
    console.warn = originalWarn
    await new Promise((resolve) => server.close(resolve))
    await openAiServer.close()
    restoreEnv()
  }
})

test('POST /api/generation-tasks stores safe fallback message when OpenAI error exposes sensitive text', async () => {
  const originalWarn = console.warn
  const warnCalls = []
  console.warn = (...args) => {
    warnCalls.push(args)
  }
  const restoreEnv = setOpenAiEnv({
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: 'http://Authorization Bearer test-openai-key prompt',
  })
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_openai_sensitive_error')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'sensitive_error')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'pending')

    const detail = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'failed')

    assert.equal(detail.response.status, 200)
    assert.equal(detail.body.data.status, 'failed')
    assert.notEqual(detail.body.data.errorMessage, null)
    assert.equal(detail.body.data.errorMessage.includes('name='), true)
    assert.equal(detail.body.data.errorMessage.includes('message='), true)
    assert.equal(detail.body.data.errorMessage.includes('test-openai-key'), false)
    assert.equal(detail.body.data.errorMessage.includes('Authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('prompt'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_sensitive_error_chapter'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_sensitive_error_diary_text'), false)
    assert.equal(warnCalls[0][0], '[generation-task-openai-fallback]')
    assert.equal(JSON.stringify(warnCalls).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(warnCalls).includes('Authorization'), false)
    assert.equal(JSON.stringify(warnCalls).includes('prompt'), false)
    assert.equal(JSON.stringify(warnCalls).includes('generation_task_sensitive_error_chapter'), false)
    assert.equal(JSON.stringify(warnCalls).includes('generation_task_sensitive_error_diary_text'), false)
  } finally {
    console.warn = originalWarn
    await new Promise((resolve) => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/generation-tasks fails safely when OpenAI response body hangs', async () => {
  const originalWarn = console.warn
  const originalInfo = console.info
  const warnCalls = []
  const infoCalls = []
  console.warn = (...args) => {
    warnCalls.push(args)
  }
  console.info = (...args) => {
    infoCalls.push(args)
  }
  const openAiServer = await createOpenAiMockServer((req, res) => {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.write('{"data":[')
  })
  const restoreEnv = setOpenAiEnv({
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: openAiServer.baseUrl,
    OPENAI_TIMEOUT_MS: '30',
  })
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_openai_hang')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'hanging_response')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'pending')

    const detail = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'failed', 30)

    assert.equal(detail.response.status, 200)
    assert.equal(detail.body.data.status, 'failed')
    assert.notEqual(detail.body.data.errorMessage, null)
    assert.notEqual(detail.body.data.finishedAt, null)
    assert.equal(detail.body.data.errorMessage.includes('name='), true)
    assert.equal(detail.body.data.errorMessage.includes('message='), true)
    assert.equal(detail.body.data.errorMessage.includes('test-openai-key'), false)
    assert.equal(detail.body.data.errorMessage.includes('Authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('authorization'), false)
    assert.equal(detail.body.data.errorMessage.includes('prompt'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_hanging_response_chapter'), false)
    assert.equal(detail.body.data.errorMessage.includes('generation_task_hanging_response_diary_text'), false)
    assert.equal(JSON.stringify(warnCalls).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(warnCalls).includes('Authorization'), false)
    assert.equal(JSON.stringify(infoCalls).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(infoCalls).includes('Authorization'), false)
    assert.equal(JSON.stringify(infoCalls).includes('generation_task_hanging_response_diary_text'), false)
  } finally {
    console.warn = originalWarn
    console.info = originalInfo
    await new Promise((resolve) => server.close(resolve))
    await openAiServer.close()
    restoreEnv()
  }
})

test('OpenAI prompt uses truncated diary summary and default character profile', async () => {
  const longDiaryHead = '今天在公园散步，看见阳光落在长椅上，心情慢慢变亮。'
  const longDiaryTail = 'TAIL_SHOULD_NOT_APPEAR_IN_OPENAI_PROMPT'
  const longDiaryText = `${longDiaryHead}${'很温暖。'.repeat(80)}${longDiaryTail}`
  const mockImage = Buffer.from('mock png bytes')
  let capturedPrompt = ''
  const openAiServer = await createOpenAiMockServer((req, res, call) => {
    capturedPrompt = call.body.prompt
    res.statusCode = 200
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      data: [
        {
          b64_json: mockImage.toString('base64'),
        },
      ],
    }))
  })
  const restoreEnv = setOpenAiEnv({
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: openAiServer.baseUrl,
  })
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_default_character')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'default_character', {
      diaryText: longDiaryText,
    })

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)
    const detail = await waitForTaskStatus(server, created.body.data.id, loginData.token, 'completed')

    assert.equal(created.response.status, 200)
    assert.equal(detail.body.data.result.pages[0].imageUrl.startsWith('/uploads/generated/'), true)
    assert.equal(capturedPrompt.includes(longDiaryHead), true)
    assert.equal(capturedPrompt.includes(longDiaryTail), false)
    assert.equal(capturedPrompt.includes('日记主人公'), true)
    assert.equal(capturedPrompt.includes('私人漫画书主角'), true)
    assert.equal(capturedPrompt.includes('Q 版大头小身比例'), true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await openAiServer.close()
    restoreEnv()
  }
})

test('user cannot create generation task from another user diary entry', async () => {
  const server = await listen(app)

  try {
    const owner = await login(server, 'generation_task_entry_owner')
    const attacker = await login(server, 'generation_task_attacker')
    const diaryEntry = await createDiaryEntry(owner.user.id, 'private')

    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, attacker.token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
    assert.equal(await prisma.generationTask.count(), 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('user cannot read another user generation task', async () => {
  const server = await listen(app)

  try {
    const owner = await login(server, 'generation_task_read_owner')
    const attacker = await login(server, 'generation_task_reader')
    const diaryEntry = await createDiaryEntry(owner.user.id, 'read')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, owner.token)
    const detail = await requestJson(server, 'GET', `/api/generation-tasks/${created.body.data.id}`, undefined, attacker.token)

    assert.equal(detail.response.status, 404)
    assert.notEqual(detail.body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('deleted diary entry cannot create generation task', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_deleted_entry')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'deleted')
    await prisma.diaryEntry.update({
      where: {
        id: diaryEntry.id,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
    assert.equal(await prisma.generationTask.count(), 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
