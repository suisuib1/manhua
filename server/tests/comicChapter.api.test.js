const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_comic_chapter_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

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

async function requestJson(server, method, requestPath, body, token) {
  const { port } = server.address()
  const headers = {
    'content-type': 'application/json',
  }

  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
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

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `recent_${suffix}_chapter`,
      diaryDate: new Date('2026-05-21T00:00:00.000Z'),
      diaryText: `recent_${suffix}_diary_text_full_content_should_not_leak`,
      pageCount: 3,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['daily', 'cute']),
      status: 'draft',
    }, overrides),
  })
}

async function createDiaryPhoto(ownerUserId, diaryEntryId, imageUrl, sortOrder = 0) {
  return prisma.diaryPhoto.create({
    data: {
      ownerUserId,
      diaryEntryId,
      imageUrl,
      sortOrder,
    },
  })
}

async function createGenerationTask(ownerUserId, diaryEntryId, suffix, overrides = {}) {
  const now = new Date(`2026-05-21T00:00:${String(overrides.second || 0).padStart(2, '0')}.000Z`)
  const result = Object.prototype.hasOwnProperty.call(overrides, 'result')
    ? overrides.result
    : {
        chapter: {
          title: `result_${suffix}_title`,
          date: '2026-05-20T00:00:00.000Z',
        },
        pages: [
          {
            pageIndex: 0,
            sortOrder: 0,
            caption: `result_${suffix}_caption`,
            imageUrl: overrides.imageUrl === undefined ? null : overrides.imageUrl,
          },
        ],
      }

  return prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId,
      status: overrides.status || 'completed',
      taskType: 'diary_to_comic',
      promptSnapshot: `prompt_${suffix}_should_not_leak`,
      inputJson: JSON.stringify({ secret: `input_${suffix}_should_not_leak` }),
      resultJson: overrides.rawResultJson === undefined ? JSON.stringify(result) : overrides.rawResultJson,
      errorMessage: overrides.errorMessage || null,
      startedAt: now,
      finishedAt: Object.prototype.hasOwnProperty.call(overrides, 'finishedAt') ? overrides.finishedAt : now,
      createdAt: now,
    },
  })
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/comic-chapters/recent requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/comic-chapters/recent')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/stats requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/comic-chapters/stats')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent only returns current user chapters', async () => {
  const server = await listen(app)

  try {
    const userA = await login(server, 'recent_owner_a')
    const userB = await login(server, 'recent_owner_b')
    const entryA = await createDiaryEntry(userA.user.id, 'owned')
    const entryB = await createDiaryEntry(userB.user.id, 'other')
    await createGenerationTask(userA.user.id, entryA.id, 'owned', { second: 2 })
    await createGenerationTask(userB.user.id, entryB.id, 'other', { second: 3 })

    const { response, body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, userA.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.items[0].id, entryA.id)
    assert.equal(body.data.items[0].diaryEntryId, entryA.id)
    assert.equal(body.data.items[0].title, 'recent_owned_chapter')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent excludes draft diaries without generation tasks', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_no_task')
    await createDiaryEntry(loginData.user.id, 'draft_only')

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.deepEqual(body.data.items, [])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent uses the latest task for the same diary', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_latest_task')
    const entry = await createDiaryEntry(loginData.user.id, 'multi_task')
    await createGenerationTask(loginData.user.id, entry.id, 'old', { second: 1, status: 'failed' })
    const latestTask = await createGenerationTask(loginData.user.id, entry.id, 'new', {
      second: 5,
      status: 'completed',
      imageUrl: '/uploads/images/latest.png',
    })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.items[0].generationTaskId, latestTask.id)
    assert.equal(body.data.items[0].status, 'completed')
    assert.equal(body.data.items[0].summary, 'result_new_caption')
    assert.equal(body.data.items[0].coverImageUrl, '/uploads/images/latest.png')
    assert.equal(body.data.items[0].hasComicImages, true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent marks mock null images as no comic images', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_null_image')
    const entry = await createDiaryEntry(loginData.user.id, 'null_image')
    await createGenerationTask(loginData.user.id, entry.id, 'null_image', {
      second: 1,
      imageUrl: null,
    })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.equal(body.data.items[0].coverImageUrl, null)
    assert.equal(body.data.items[0].hasComicImages, false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent falls back coverImageUrl to first diary photo', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_photo_cover')
    const entry = await createDiaryEntry(loginData.user.id, 'photo_cover')
    await createDiaryPhoto(loginData.user.id, entry.id, '/uploads/images/second.png', 2)
    await createDiaryPhoto(loginData.user.id, entry.id, '/uploads/images/first.png', 1)
    await createGenerationTask(loginData.user.id, entry.id, 'photo_cover', {
      second: 1,
      imageUrl: null,
    })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.equal(body.data.items[0].coverImageUrl, '/uploads/images/first.png')
    assert.equal(body.data.items[0].hasComicImages, false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent excludes soft deleted diaries', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_deleted')
    const entry = await createDiaryEntry(loginData.user.id, 'deleted', {
      deletedAt: new Date(),
    })
    await createGenerationTask(loginData.user.id, entry.id, 'deleted', { second: 1 })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.deepEqual(body.data.items, [])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent applies limit', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_limit')

    for (let index = 0; index < 3; index += 1) {
      const entry = await createDiaryEntry(loginData.user.id, `limit_${index}`)
      await createGenerationTask(loginData.user.id, entry.id, `limit_${index}`, { second: index })
    }

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent?limit=2', undefined, loginData.token)

    assert.equal(body.data.items.length, 2)
    assert.deepEqual(body.data.items.map((item) => item.title), [
      'recent_limit_2_chapter',
      'recent_limit_1_chapter',
    ])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent caps limit at 20', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_limit_cap')

    for (let index = 0; index < 21; index += 1) {
      const entry = await createDiaryEntry(loginData.user.id, `cap_${index}`)
      await createGenerationTask(loginData.user.id, entry.id, `cap_${index}`, { second: index % 60 })
    }

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent?limit=99', undefined, loginData.token)

    assert.equal(body.data.items.length, 20)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent does not expose internal or private fields', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_no_leak')
    const fullText = '这是一段不应该完整返回给列表接口的日记正文，后面还有更多隐私内容需要被截断'
    const entry = await createDiaryEntry(loginData.user.id, 'no_leak', {
      chapterTitle: null,
      diaryText: fullText,
    })
    await createGenerationTask(loginData.user.id, entry.id, 'no_leak', {
      second: 1,
      rawResultJson: '{bad json',
    })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)
    const item = body.data.items[0]

    assert.equal(item.title, '未命名章节')
    assert.equal(item.summary, fullText.slice(0, 24))
    assert.equal(item.ownerUserId, undefined)
    assert.equal(item.diaryText, undefined)
    assert.equal(item.promptSnapshot, undefined)
    assert.equal(item.inputJson, undefined)
    assert.equal(item.resultJson, undefined)
    assert.equal(JSON.stringify(item).includes(fullText), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/recent returns failed after stale latest task is marked failed', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'recent_stale_generation')
    const entry = await createDiaryEntry(loginData.user.id, 'stale_generation')
    const oldTime = new Date('2026-05-21T00:00:00.000Z')
    const staleTask = await createGenerationTask(loginData.user.id, entry.id, 'stale_generation', {
      second: 1,
      status: 'processing',
      imageUrl: null,
      finishedAt: null,
    })
    await prisma.generationTask.update({
      where: {
        id: staleTask.id,
      },
      data: {
        startedAt: oldTime,
        updatedAt: oldTime,
      },
    })

    await markStaleGenerationTasksFailed({
      now: new Date('2026-05-21T00:20:00.000Z'),
      timeoutMs: 5 * 60 * 1000,
    })

    const { body } = await requestJson(server, 'GET', '/api/comic-chapters/recent', undefined, loginData.token)

    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.items[0].generationTaskId, staleTask.id)
    assert.equal(body.data.items[0].status, 'failed')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/comic-chapters/stats counts only current user latest task per active diary', async () => {
  const server = await listen(app)

  try {
    const userA = await login(server, 'stats_owner_a')
    const userB = await login(server, 'stats_owner_b')

    const completedEntry = await createDiaryEntry(userA.user.id, 'stats_completed')
    await createGenerationTask(userA.user.id, completedEntry.id, 'stats_completed', {
      second: 1,
      status: 'completed',
      imageUrl: '/uploads/generated/stats-completed.png',
    })

    const processingEntry = await createDiaryEntry(userA.user.id, 'stats_processing')
    await createGenerationTask(userA.user.id, processingEntry.id, 'stats_processing', {
      second: 2,
      status: 'processing',
      imageUrl: null,
    })

    const pendingEntry = await createDiaryEntry(userA.user.id, 'stats_pending')
    await createGenerationTask(userA.user.id, pendingEntry.id, 'stats_pending', {
      second: 3,
      status: 'pending',
      imageUrl: null,
    })

    const failedEntry = await createDiaryEntry(userA.user.id, 'stats_failed')
    await createGenerationTask(userA.user.id, failedEntry.id, 'stats_failed', {
      second: 4,
      status: 'failed',
      imageUrl: null,
    })

    const noImageEntry = await createDiaryEntry(userA.user.id, 'stats_no_image')
    await createGenerationTask(userA.user.id, noImageEntry.id, 'stats_no_image', {
      second: 5,
      status: 'completed',
      imageUrl: null,
    })

    const deletedEntry = await createDiaryEntry(userA.user.id, 'stats_deleted', {
      deletedAt: new Date(),
    })
    await createGenerationTask(userA.user.id, deletedEntry.id, 'stats_deleted', {
      second: 6,
      status: 'completed',
      imageUrl: '/uploads/generated/deleted.png',
    })

    const latestEntry = await createDiaryEntry(userA.user.id, 'stats_latest')
    await createGenerationTask(userA.user.id, latestEntry.id, 'stats_latest_old', {
      second: 7,
      status: 'completed',
      imageUrl: '/uploads/generated/old.png',
    })
    await createGenerationTask(userA.user.id, latestEntry.id, 'stats_latest_new', {
      second: 8,
      status: 'processing',
      imageUrl: null,
    })

    const otherEntry = await createDiaryEntry(userB.user.id, 'stats_other')
    await createGenerationTask(userB.user.id, otherEntry.id, 'stats_other', {
      second: 9,
      status: 'completed',
      imageUrl: '/uploads/generated/other.png',
    })

    const { response, body } = await requestJson(server, 'GET', '/api/comic-chapters/stats', undefined, userA.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.deepEqual(body.data, {
      totalChapters: 6,
      completedChapters: 1,
      generatingChapters: 3,
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
