const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_user_jwt_secret'
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
      username: 'user_admin',
      passwordHash: await hashAdminPassword('user-admin-password'),
      displayName: 'User Admin',
      status: 'active',
    },
  })

  const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
    username: 'user_admin',
    password: 'user-admin-password',
  })

  return login.body.data.token
}

async function loginUser(server, code = 'admin_user_token') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
  })

  return body.data
}

async function createUser(suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  const user = await prisma.user.create({
    data: {
      wxOpenid: `admin_user_openid_${suffix}_tail`,
      status: overrides.status || 'active',
      createdAt,
      updatedAt: overrides.updatedAt || createdAt,
    },
  })

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      nickname: overrides.nickname || `用户_${suffix}`,
      avatarUrl: overrides.avatarUrl || `https://example.com/${suffix}.png`,
      bio: overrides.bio || `bio_${suffix}`,
    },
  })

  await prisma.userSetting.create({
    data: {
      userId: user.id,
    },
  })

  await prisma.comicBook.create({
    data: {
      ownerUserId: user.id,
    },
  })

  await prisma.userQuota.create({
    data: {
      userId: user.id,
    },
  })

  return user
}

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `user_${suffix}_chapter`,
      diaryDate: new Date('2026-05-28T00:00:00.000Z'),
      diaryText: `user_${suffix}_private_diary`,
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

test('GET /api/admin/users requires admin token', async () => {
  const server = await listen(app)

  try {
    const missing = await requestJson(server, 'GET', '/api/admin/users')
    assert.equal(missing.response.status, 401)
    assert.equal(missing.body.code, 401)

    const userLogin = await loginUser(server)
    const userToken = await requestJson(server, 'GET', '/api/admin/users', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/users returns paginated users with safe summary stats', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const firstUser = await createUser('first', {
      nickname: '碎碎',
      createdAt: new Date('2026-05-28T00:00:00.000Z'),
    })
    const secondUser = await createUser('second', {
      nickname: '另一个用户',
      createdAt: new Date('2026-05-29T00:00:00.000Z'),
    })

    const activeDiary = await createDiaryEntry(firstUser.id, 'active')
    const deletedDiary = await createDiaryEntry(firstUser.id, 'deleted', {
      deletedAt: new Date('2026-05-28T01:00:00.000Z'),
    })
    await createGenerationTask(firstUser.id, activeDiary.id, 'completed_with_image', {
      status: 'completed',
      imageUrl: '/uploads/generated/user-completed.png',
      createdAt: new Date('2026-05-28T02:00:00.000Z'),
    })
    await createGenerationTask(firstUser.id, activeDiary.id, 'completed_no_image', {
      status: 'completed',
      result: { pages: [{ caption: 'no image' }] },
      createdAt: new Date('2026-05-28T03:00:00.000Z'),
    })
    await createGenerationTask(firstUser.id, activeDiary.id, 'processing', {
      status: 'processing',
      createdAt: new Date('2026-05-28T04:00:00.000Z'),
    })
    await createGenerationTask(firstUser.id, deletedDiary.id, 'failed_deleted_diary_task_counts_as_task', {
      status: 'failed',
      createdAt: new Date('2026-05-28T05:00:00.000Z'),
    })
    await prisma.characterProfile.create({
      data: {
        ownerUserId: firstUser.id,
        nickname: '角色碎碎',
      },
    })

    const { response, body } = await requestJson(server, 'GET', '/api/admin/users?page=1&pageSize=1', undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.pagination.page, 1)
    assert.equal(body.data.pagination.pageSize, 1)
    assert.equal(body.data.pagination.total, 2)
    assert.equal(body.data.items[0].id, secondUser.id)

    const byKeyword = await requestJson(server, 'GET', '/api/admin/users?keyword=碎碎', undefined, token)
    assert.equal(byKeyword.body.data.items.length, 1)
    const item = byKeyword.body.data.items[0]
    assert.equal(item.id, firstUser.id)
    assert.equal(item.nickname, '碎碎')
    assert.equal(item.avatarUrl, 'https://example.com/first.png')
    assert.equal(item.diaryEntryCount, 1)
    assert.equal(item.generationTaskCount, 4)
    assert.equal(item.completedChapterCount, 1)
    assert.equal(item.generatingTaskCount, 1)
    assert.equal(item.failedTaskCount, 1)
    assert.equal(item.hasCharacterProfile, true)
    assert.equal(Boolean(item.latestDiaryAt), true)
    assert.equal(Boolean(item.latestGenerationTaskAt), true)

    const serialized = JSON.stringify(item)
    assert.equal(serialized.includes('openid'), false)
    assert.equal(serialized.includes('session'), false)
    assert.equal(serialized.includes('token'), false)
    assert.equal(serialized.includes('passwordHash'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/users filters by keyword id and created date range', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const oldUser = await createUser('old', {
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
    })
    const todayUser = await createUser('today', {
      createdAt: new Date('2026-05-28T12:00:00.000Z'),
    })

    const byDate = await requestJson(
      server,
      'GET',
      '/api/admin/users?dateFrom=2026-05-28&dateTo=2026-05-28',
      undefined,
      token,
    )
    assert.deepEqual(byDate.body.data.items.map((item) => item.id), [todayUser.id])

    const byId = await requestJson(server, 'GET', `/api/admin/users?keyword=${oldUser.id}`, undefined, token)
    assert.deepEqual(byId.body.data.items.map((item) => item.id), [oldUser.id])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/users/:id returns user detail without sensitive task fields', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('detail', {
      nickname: '详情用户',
      bio: '这是用户简介',
    })
    const diary = await createDiaryEntry(user.id, 'detail', {
      chapterTitle: '详情章节',
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
    })
    await prisma.characterProfile.create({
      data: {
        ownerUserId: user.id,
        nickname: '角色名',
        roleTitle: '默认漫画书主角',
        description: '角色描述',
        personalityText: '温柔',
        appearanceText: '短发',
        referenceImageUrl: '/uploads/images/reference.png',
      },
    })
    const failedTask = await createGenerationTask(user.id, diary.id, 'failed', {
      status: 'failed',
      createdAt: new Date('2026-05-28T00:00:02.000Z'),
    })
    const completedTask = await createGenerationTask(user.id, diary.id, 'completed', {
      status: 'completed',
      imageUrl: '/uploads/generated/detail.png',
      createdAt: new Date('2026-05-28T00:00:03.000Z'),
    })

    const { response, body } = await requestJson(server, 'GET', `/api/admin/users/${user.id}`, undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.user.id, user.id)
    assert.equal(body.data.user.nickname, '详情用户')
    assert.equal(body.data.user.avatarUrl, 'https://example.com/detail.png')
    assert.equal(body.data.user.bio, '这是用户简介')
    assert.equal(body.data.stats.diaryEntryCount, 1)
    assert.equal(body.data.stats.generationTaskCount, 2)
    assert.equal(body.data.stats.completedChapterCount, 1)
    assert.equal(body.data.stats.generatingTaskCount, 0)
    assert.equal(body.data.stats.failedTaskCount, 1)
    assert.equal(body.data.characterProfile.nickname, '角色名')
    assert.equal(body.data.characterProfile.referenceImageUrl, '/uploads/images/reference.png')
    assert.equal(body.data.recentChapters.length, 1)
    assert.equal(body.data.recentChapters[0].diaryEntryId, diary.id)
    assert.equal(body.data.recentChapters[0].title, '详情章节')
    assert.equal(body.data.recentChapters[0].status, 'completed')
    assert.equal(body.data.recentChapters[0].coverImageUrl, '/uploads/generated/detail.png')
    assert.deepEqual(body.data.recentGenerationTasks.map((item) => item.id), [completedTask.id, failedTask.id])
    assert.equal(body.data.recentGenerationTasks[0].hasImage, true)
    assert.equal(body.data.recentGenerationTasks[1].hasImage, false)

    const serialized = JSON.stringify(body.data)
    assert.equal(serialized.includes('wxOpenid'), false)
    assert.equal(serialized.includes('openid'), false)
    assert.equal(serialized.includes('session'), false)
    assert.equal(serialized.includes('token'), false)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('promptSnapshot'), false)
    assert.equal(serialized.includes('inputJson'), false)
    assert.equal(serialized.includes('resultJson'), false)
    assert.equal(serialized.includes('prompt_'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/users/:id returns 404 for missing user', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const { response, body } = await requestJson(server, 'GET', '/api/admin/users/missing-user-id', undefined, token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
