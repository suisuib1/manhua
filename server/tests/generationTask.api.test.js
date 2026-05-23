const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_generation_task_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'
delete process.env.OPENAI_API_KEY

const { clearCoreTables, prisma } = require('./helpers/testDatabase')
const { app } = require('../src/app')

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
        close: () => new Promise((done) => server.close(done)),
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

test('logged in user can create and read a completed mock generation task', async () => {
  const server = await listen(app)

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

    const foundTask = await prisma.generationTask.findUnique({
      where: {
        id: created.body.data.id,
      },
    })
    assert.equal(foundTask.ownerUserId, loginData.user.id)
    assert.equal(foundTask.status, 'completed')

    const detail = await requestJson(server, 'GET', `/api/generation-tasks/${created.body.data.id}`, undefined, loginData.token)

    assert.equal(detail.response.status, 200)
    assert.deepEqual(detail.body.data, created.body.data)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/generation-tasks returns first OpenAI image when configured', async () => {
  const mockImage = Buffer.from('mock png bytes')
  const openAiServer = await createOpenAiMockServer((req, res, call) => {
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
    assert.equal(created.body.data.status, 'completed')
    assert.equal(created.body.data.result.chapter.source, 'openai')
    assert.equal(created.body.data.result.pages[0].mock, false)
    assert.equal(created.body.data.result.pages[0].imageUrl.startsWith('/uploads/generated/'), true)
    assert.equal(created.body.data.result.pages[0].caption, '根据日记内容生成的第一页漫画')
    assert.equal(JSON.stringify(created.body.data).includes('test-openai-key'), false)
    assert.equal(JSON.stringify(created.body.data).includes('b64_json'), false)
    assert.equal(openAiServer.calls.length, 1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await openAiServer.close()
    restoreEnv()
  }
})

test('POST /api/generation-tasks falls back when OpenAI fails', async () => {
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
    assert.equal(created.body.data.status, 'completed')
    assert.equal(created.body.data.result.chapter.source, 'mock')
    assert.equal(created.body.data.result.pages[0].mock, true)
    assert.equal(created.body.data.result.pages[0].imageUrl, null)
    assert.equal(JSON.stringify(created.body.data).includes('test-openai-key'), false)
  } finally {
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

    assert.equal(created.response.status, 200)
    assert.equal(created.body.data.result.pages[0].imageUrl.startsWith('/uploads/generated/'), true)
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
