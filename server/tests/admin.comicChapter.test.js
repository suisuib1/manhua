const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_comic_chapter_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

const { clearCoreTables, prisma } = require('./helpers/testDatabase')
const { app } = require('../src/app')
const { hashAdminPassword } = require('../src/services/admin.service')

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

async function createAdminAndToken(server) {
  await prisma.adminUser.create({
    data: {
      username: 'chapter_admin',
      passwordHash: await hashAdminPassword('chapter-admin-password'),
      displayName: 'Chapter Admin',
      status: 'active',
    },
  })

  const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
    username: 'chapter_admin',
    password: 'chapter-admin-password',
  })

  return login.body.data.token
}

async function loginUser(server, code = 'admin_comic_chapter_user') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
  })

  return body.data
}

async function createUser(suffix, nickname = `chapter_user_${suffix}`) {
  const user = await prisma.user.create({
    data: {
      wxOpenid: `admin_comic_chapter_openid_${suffix}`,
      status: 'active',
    },
  })

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      nickname,
    },
  })

  return user
}

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `chapter_${suffix}_title`,
      diaryDate: new Date('2026-05-28T00:00:00.000Z'),
      diaryText: `chapter_${suffix}_private_content_${'long_content_'.repeat(30)}`,
      pageCount: 1,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['happy']),
      status: 'draft',
      createdAt: new Date('2026-05-28T00:00:00.000Z'),
    }, overrides),
  })
}

async function createGenerationTask(ownerUserId, diaryEntryId, suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  const result = Object.prototype.hasOwnProperty.call(overrides, 'result')
    ? overrides.result
    : {
        pages: [
          {
            imageUrl: overrides.imageUrl || null,
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
      inputJson: JSON.stringify({ privateInput: `input_${suffix}_should_not_leak` }),
      resultJson: JSON.stringify(result),
      errorMessage: overrides.errorMessage || null,
      startedAt: createdAt,
      finishedAt: overrides.finishedAt || createdAt,
      createdAt,
    },
  })
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/admin/comic-chapters requires admin token', async () => {
  const server = await listen(app)

  try {
    const missing = await requestJson(server, 'GET', '/api/admin/comic-chapters')
    assert.equal(missing.response.status, 401)
    assert.equal(missing.body.code, 401)

    const userLogin = await loginUser(server)
    const userToken = await requestJson(server, 'GET', '/api/admin/comic-chapters', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/comic-chapters returns paginated chapter summaries', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('list', '章节用户')
    const newestEntry = await createDiaryEntry(user.id, 'newest', {
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
    })
    const oldestEntry = await createDiaryEntry(user.id, 'oldest', {
      createdAt: new Date('2026-05-28T00:00:00.000Z'),
    })
    const latestTask = await createGenerationTask(user.id, newestEntry.id, 'newest', {
      status: 'completed',
      imageUrl: '/uploads/generated/newest.png',
      createdAt: new Date('2026-05-28T00:00:05.000Z'),
      finishedAt: new Date('2026-05-28T00:00:09.000Z'),
    })
    await createGenerationTask(user.id, oldestEntry.id, 'oldest', {
      status: 'failed',
      createdAt: new Date('2026-05-28T00:00:02.000Z'),
    })

    const { response, body } = await requestJson(server, 'GET', '/api/admin/comic-chapters?page=1&pageSize=1', undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.pagination.page, 1)
    assert.equal(body.data.pagination.pageSize, 1)
    assert.equal(body.data.pagination.total, 2)

    const item = body.data.items[0]
    assert.equal(item.diaryEntryId, newestEntry.id)
    assert.equal(item.ownerUserId, user.id)
    assert.equal(item.title, 'chapter_newest_title')
    assert.equal(item.mood, 'happy')
    assert.equal(item.summary.length <= 80, true)
    assert.equal(item.status, 'completed')
    assert.equal(item.generationTaskId, latestTask.id)
    assert.equal(item.hasImage, true)
    assert.equal(item.coverImageUrl, '/uploads/generated/newest.png')
    assert.equal(item.userNickname, '章节用户')
    assert.equal(Boolean(item.taskCreatedAt), true)
    assert.equal(Boolean(item.taskFinishedAt), true)
    assert.equal(item.promptSnapshot, undefined)
    assert.equal(item.inputJson, undefined)
    assert.equal(item.resultJson, undefined)
    assert.equal(item.diaryText, undefined)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/comic-chapters filters keyword and status with latest task per diary', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('filter')
    const completedEntry = await createDiaryEntry(user.id, 'birthday', {
      chapterTitle: '今天过生日',
    })
    const processingEntry = await createDiaryEntry(user.id, 'processing')
    const failedEntry = await createDiaryEntry(user.id, 'failed')
    const noTaskEntry = await createDiaryEntry(user.id, 'no_task')

    await createGenerationTask(user.id, completedEntry.id, 'old_failed', {
      status: 'failed',
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
    })
    const latestCompleted = await createGenerationTask(user.id, completedEntry.id, 'latest_completed', {
      status: 'completed',
      imageUrl: '/uploads/generated/latest.png',
      createdAt: new Date('2026-05-28T00:00:05.000Z'),
    })
    await createGenerationTask(user.id, processingEntry.id, 'processing', {
      status: 'processing',
    })
    await createGenerationTask(user.id, failedEntry.id, 'failed', {
      status: 'failed',
    })

    const completed = await requestJson(server, 'GET', '/api/admin/comic-chapters?status=completed', undefined, token)
    assert.deepEqual(completed.body.data.items.map((item) => item.diaryEntryId), [completedEntry.id])
    assert.equal(completed.body.data.items[0].generationTaskId, latestCompleted.id)

    const processing = await requestJson(server, 'GET', '/api/admin/comic-chapters?status=processing', undefined, token)
    assert.deepEqual(processing.body.data.items.map((item) => item.diaryEntryId), [processingEntry.id])

    const failed = await requestJson(server, 'GET', '/api/admin/comic-chapters?status=failed', undefined, token)
    assert.deepEqual(failed.body.data.items.map((item) => item.diaryEntryId), [failedEntry.id])

    const noTask = await requestJson(server, 'GET', '/api/admin/comic-chapters?status=no_task', undefined, token)
    assert.deepEqual(noTask.body.data.items.map((item) => item.diaryEntryId), [noTaskEntry.id])
    assert.equal(noTask.body.data.items[0].status, 'no_task')
    assert.equal(noTask.body.data.items[0].generationTaskId, null)

    const byTitle = await requestJson(server, 'GET', '/api/admin/comic-chapters?keyword=生日', undefined, token)
    assert.deepEqual(byTitle.body.data.items.map((item) => item.diaryEntryId), [completedEntry.id])

    const byDiaryId = await requestJson(server, 'GET', `/api/admin/comic-chapters?keyword=${failedEntry.id}`, undefined, token)
    assert.deepEqual(byDiaryId.body.data.items.map((item) => item.diaryEntryId), [failedEntry.id])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/comic-chapters handles image state, date filters, and soft deletes', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('date')
    const withImage = await createDiaryEntry(user.id, 'with_image', {
      createdAt: new Date('2026-05-28T12:00:00.000Z'),
    })
    const withoutImage = await createDiaryEntry(user.id, 'without_image', {
      createdAt: new Date('2026-05-28T13:00:00.000Z'),
    })
    const deleted = await createDiaryEntry(user.id, 'deleted', {
      createdAt: new Date('2026-05-28T14:00:00.000Z'),
      deletedAt: new Date('2026-05-28T15:00:00.000Z'),
    })
    const old = await createDiaryEntry(user.id, 'old', {
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
    })
    await createGenerationTask(user.id, withImage.id, 'with_image', {
      status: 'completed',
      imageUrl: '/uploads/generated/with-image.png',
    })
    await createGenerationTask(user.id, withoutImage.id, 'without_image', {
      status: 'completed',
      result: { pages: [{ caption: 'no image' }] },
    })
    await createGenerationTask(user.id, deleted.id, 'deleted', {
      status: 'completed',
      imageUrl: '/uploads/generated/deleted.png',
    })
    await createGenerationTask(user.id, old.id, 'old', {
      status: 'completed',
      imageUrl: '/uploads/generated/old.png',
    })

    const filtered = await requestJson(
      server,
      'GET',
      '/api/admin/comic-chapters?dateFrom=2026-05-28&dateTo=2026-05-28&status=completed',
      undefined,
      token,
    )

    const ids = filtered.body.data.items.map((item) => item.diaryEntryId).sort()
    assert.deepEqual(ids, [withImage.id, withoutImage.id].sort())
    const withImageItem = filtered.body.data.items.find((item) => item.diaryEntryId === withImage.id)
    const withoutImageItem = filtered.body.data.items.find((item) => item.diaryEntryId === withoutImage.id)
    assert.equal(withImageItem.hasImage, true)
    assert.equal(withImageItem.coverImageUrl, '/uploads/generated/with-image.png')
    assert.equal(withoutImageItem.hasImage, false)
    assert.equal(withoutImageItem.coverImageUrl, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/comic-chapters/:diaryEntryId returns detail with task history', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('detail', '详情章节用户')
    const diary = await createDiaryEntry(user.id, 'detail', {
      diaryText: `detail_full_content_${'private_content_'.repeat(40)}`,
    })
    const oldTask = await createGenerationTask(user.id, diary.id, 'old', {
      status: 'failed',
      errorMessage: 'old failed error should not leak prompt fields',
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
    })
    const latestTask = await createGenerationTask(user.id, diary.id, 'latest', {
      status: 'completed',
      imageUrl: '/uploads/generated/detail.png',
      createdAt: new Date('2026-05-28T00:00:05.000Z'),
    })

    const { response, body } = await requestJson(server, 'GET', `/api/admin/comic-chapters/${diary.id}`, undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.diary.id, diary.id)
    assert.equal(body.data.diary.ownerUserId, user.id)
    assert.equal(body.data.diary.title, 'chapter_detail_title')
    assert.equal(body.data.diary.content, diary.diaryText)
    assert.equal(body.data.diary.mood, 'happy')
    assert.equal(body.data.user.id, user.id)
    assert.equal(body.data.user.nickname, '详情章节用户')
    assert.equal(body.data.latestTask.id, latestTask.id)
    assert.equal(body.data.latestTask.status, 'completed')
    assert.equal(body.data.latestTask.hasImage, true)
    assert.equal(body.data.latestTask.imageUrl, '/uploads/generated/detail.png')
    assert.deepEqual(body.data.taskHistory.map((item) => item.id), [latestTask.id, oldTask.id])
    assert.equal(body.data.taskHistory[0].hasImage, true)
    assert.equal(body.data.taskHistory[1].hasImage, false)

    const serialized = JSON.stringify(body.data)
    assert.equal(serialized.includes('promptSnapshot'), false)
    assert.equal(serialized.includes('inputJson'), false)
    assert.equal(serialized.includes('resultJson'), false)
    assert.equal(serialized.includes('prompt_'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/comic-chapters/:diaryEntryId returns 404 for missing chapter', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const { response, body } = await requestJson(server, 'GET', '/api/admin/comic-chapters/missing-diary-id', undefined, token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
