const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_character_profile_jwt_secret'
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
      username: 'character_admin',
      passwordHash: await hashAdminPassword('character-admin-password'),
      displayName: 'Character Admin',
      status: 'active',
    },
  })

  const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
    username: 'character_admin',
    password: 'character-admin-password',
  })

  return login.body.data.token
}

async function loginUser(server, code = 'admin_character_profile_user') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
  })

  return body.data
}

async function createUser(suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  const user = await prisma.user.create({
    data: {
      wxOpenid: `admin_character_openid_${suffix}`,
      status: 'active',
      createdAt,
      updatedAt: overrides.updatedAt || createdAt,
    },
  })

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      nickname: overrides.nickname || `user_${suffix}`,
      avatarUrl: overrides.avatarUrl || `https://example.com/${suffix}.png`,
      bio: overrides.bio || '',
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

async function createCharacterProfile(ownerUserId, suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  return prisma.characterProfile.create({
    data: {
      ownerUserId,
      nickname: overrides.nickname || `role_${suffix}`,
      roleTitle: overrides.roleTitle || '默认漫画书主角',
      description: overrides.description || `description_${suffix}`,
      personalityText: overrides.personalityText || '温柔、好奇',
      appearanceText: overrides.appearanceText || '短发、圆眼睛',
      referenceImageUrl: overrides.referenceImageUrl || `/uploads/images/${suffix}.png`,
      createdAt,
      updatedAt: overrides.updatedAt || createdAt,
    },
  })
}

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `chapter_${suffix}`,
      diaryDate: new Date('2026-05-28T00:00:00.000Z'),
      diaryText: `private diary ${suffix}`,
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

test('GET /api/admin/character-profiles requires admin token', async () => {
  const server = await listen(app)

  try {
    const missing = await requestJson(server, 'GET', '/api/admin/character-profiles')
    assert.equal(missing.response.status, 401)
    assert.equal(missing.body.code, 401)

    const userLogin = await loginUser(server)
    const userToken = await requestJson(server, 'GET', '/api/admin/character-profiles', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/character-profiles returns paginated profiles with safe fields', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const firstUser = await createUser('first', {
      nickname: '用户碎碎',
      createdAt: new Date('2026-05-27T00:00:00.000Z'),
    })
    const secondUser = await createUser('second', {
      nickname: '另一个用户',
      createdAt: new Date('2026-05-28T00:00:00.000Z'),
    })
    const firstProfile = await createCharacterProfile(firstUser.id, 'first', {
      nickname: '碎碎',
      roleTitle: '默认漫画书主角',
      description: '中分蓬松短发',
      updatedAt: new Date('2026-05-27T12:00:00.000Z'),
    })
    const secondProfile = await createCharacterProfile(secondUser.id, 'second', {
      nickname: '小雨',
      updatedAt: new Date('2026-05-28T12:00:00.000Z'),
    })
    const diary = await createDiaryEntry(firstUser.id, 'first')
    await createGenerationTask(firstUser.id, diary.id, 'first_completed', {
      imageUrl: '/uploads/generated/first.png',
    })
    await createGenerationTask(firstUser.id, diary.id, 'first_failed', {
      status: 'failed',
      createdAt: new Date('2026-05-28T01:00:00.000Z'),
    })

    const paged = await requestJson(server, 'GET', '/api/admin/character-profiles?page=1&pageSize=1', undefined, token)

    assert.equal(paged.response.status, 200)
    assert.equal(paged.body.code, 0)
    assert.equal(paged.body.data.items.length, 1)
    assert.equal(paged.body.data.pagination.page, 1)
    assert.equal(paged.body.data.pagination.pageSize, 1)
    assert.equal(paged.body.data.pagination.total, 2)
    assert.equal(paged.body.data.items[0].id, secondProfile.id)

    const byKeyword = await requestJson(server, 'GET', '/api/admin/character-profiles?keyword=碎碎', undefined, token)
    assert.equal(byKeyword.body.data.items.length, 1)
    const item = byKeyword.body.data.items[0]
    assert.equal(item.id, firstProfile.id)
    assert.equal(item.ownerUserId, firstUser.id)
    assert.equal(item.userNickname, '用户碎碎')
    assert.equal(item.userAvatarUrl, 'https://example.com/first.png')
    assert.equal(item.nickname, '碎碎')
    assert.equal(item.roleTitle, '默认漫画书主角')
    assert.equal(item.description, '中分蓬松短发')
    assert.equal(item.diaryEntryCount, 1)
    assert.equal(item.generationTaskCount, 2)

    const serialized = JSON.stringify(item)
    assert.equal(serialized.includes('openid'), false)
    assert.equal(serialized.includes('session'), false)
    assert.equal(serialized.includes('token'), false)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('promptSnapshot'), false)
    assert.equal(serialized.includes('inputJson'), false)
    assert.equal(serialized.includes('resultJson'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/character-profiles filters by user nickname and updated date range', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const oldUser = await createUser('old', { nickname: '旧用户' })
    const todayUser = await createUser('today', { nickname: '今日用户' })
    const oldProfile = await createCharacterProfile(oldUser.id, 'old', {
      nickname: '旧角色',
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    })
    const todayProfile = await createCharacterProfile(todayUser.id, 'today', {
      nickname: '今日角色',
      updatedAt: new Date('2026-05-28T12:00:00.000Z'),
    })

    const byDate = await requestJson(
      server,
      'GET',
      '/api/admin/character-profiles?dateFrom=2026-05-28&dateTo=2026-05-28',
      undefined,
      token,
    )
    assert.deepEqual(byDate.body.data.items.map((item) => item.id), [todayProfile.id])

    const byUserNickname = await requestJson(server, 'GET', '/api/admin/character-profiles?keyword=旧用户', undefined, token)
    assert.deepEqual(byUserNickname.body.data.items.map((item) => item.id), [oldProfile.id])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/character-profiles/:id returns detail safely', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('detail', {
      nickname: '详情用户',
      avatarUrl: '/uploads/images/avatar.png',
      createdAt: new Date('2026-05-26T00:00:00.000Z'),
    })
    const profile = await createCharacterProfile(user.id, 'detail', {
      nickname: '详情角色',
      roleTitle: '默认漫画书主角',
      description: '红色吊带',
      personalityText: '温柔、爱笑',
      appearanceText: '短发、圆眼睛',
      referenceImageUrl: '/uploads/images/reference.png',
      updatedAt: new Date('2026-05-28T00:00:00.000Z'),
    })
    const diary = await createDiaryEntry(user.id, 'detail', {
      chapterTitle: '详情章节',
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
    })
    const failedTask = await createGenerationTask(user.id, diary.id, 'detail_failed', {
      status: 'failed',
      createdAt: new Date('2026-05-28T00:00:02.000Z'),
    })
    const completedTask = await createGenerationTask(user.id, diary.id, 'detail_completed', {
      status: 'completed',
      imageUrl: '/uploads/generated/detail.png',
      createdAt: new Date('2026-05-28T00:00:03.000Z'),
    })

    const { response, body } = await requestJson(server, 'GET', `/api/admin/character-profiles/${profile.id}`, undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.profile.id, profile.id)
    assert.equal(body.data.profile.ownerUserId, user.id)
    assert.equal(body.data.profile.nickname, '详情角色')
    assert.equal(body.data.profile.referenceImageUrl, '/uploads/images/reference.png')
    assert.equal(body.data.user.id, user.id)
    assert.equal(body.data.user.nickname, '详情用户')
    assert.equal(body.data.user.avatarUrl, '/uploads/images/avatar.png')
    assert.equal(body.data.stats.diaryEntryCount, 1)
    assert.equal(body.data.stats.generationTaskCount, 2)
    assert.equal(body.data.stats.completedChapterCount, 1)
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

test('GET /api/admin/character-profiles/:id rejects user token and returns 404 for missing profile', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const userLogin = await loginUser(server)

    const userToken = await requestJson(server, 'GET', '/api/admin/character-profiles/missing-profile-id', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)

    const missing = await requestJson(server, 'GET', '/api/admin/character-profiles/missing-profile-id', undefined, token)
    assert.equal(missing.response.status, 404)
    assert.notEqual(missing.body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
