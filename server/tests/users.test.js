const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_issue4_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

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

async function login(server, code = 'test_issue4_login') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
    profile: {
      nickname: 'Issue4 用户',
      avatarUrl: 'https://example.com/issue4-avatar.png',
    },
  })

  return body.data
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/users/me requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/users/me')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.message, '请先登录')
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/users/me returns only the current user bundle without WeChat identifiers', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue4_me')
    const { response, body } = await requestJson(server, 'GET', '/api/users/me', undefined, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.user.id, loginData.user.id)
    assert.equal(body.data.user.status, 'active')
    assert.equal(Boolean(body.data.user.lastLoginAt), true)
    assert.equal(body.data.profile.nickname, 'Issue4 用户')
    assert.equal(body.data.profile.avatarUrl, 'https://example.com/issue4-avatar.png')
    assert.equal(body.data.settings.autoSaveDraft, true)
    assert.equal(body.data.settings.keepPhotoMood, true)
    assert.equal(body.data.settings.privateMode, true)
    assert.equal(body.data.settings.diaryReminder, false)
    assert.equal(body.data.settings.generationReminder, true)
    assert.equal(body.data.comicBook.title, '我的漫画日记')
    assert.equal(body.data.comicBook.visibility, 'private')
    assert.equal(body.data.quota.totalQuota, 0)
    assert.equal(body.data.quota.usedQuota, 0)
    assert.equal(body.data.quota.remainingQuota, 0)

    const serialized = JSON.stringify(body.data)
    assert.equal(serialized.includes('wxOpenid'), false)
    assert.equal(serialized.includes('wxUnionid'), false)
    assert.equal(serialized.includes('session'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/profile updates allowed profile fields only', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue4_profile')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/profile', {
      nickname: '新的昵称',
      avatarUrl: 'https://example.com/new-avatar.png',
      bio: '新的简介',
      userId: 'attacker_user_id',
      status: 'disabled',
    }, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.nickname, '新的昵称')
    assert.equal(body.data.avatarUrl, 'https://example.com/new-avatar.png')
    assert.equal(body.data.bio, '新的简介')
    assert.equal(body.data.userId, undefined)

    const user = await prisma.user.findUnique({
      where: { id: loginData.user.id },
      include: { profile: true },
    })
    assert.equal(user.status, 'active')
    assert.equal(user.profile.userId, loginData.user.id)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/users/me/settings returns default settings', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue4_settings_get')
    const { response, body } = await requestJson(server, 'GET', '/api/users/me/settings', undefined, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.deepEqual(body.data, {
      autoSaveDraft: true,
      keepPhotoMood: true,
      privateMode: true,
      diaryReminder: false,
      generationReminder: true,
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/settings updates boolean settings and keeps omitted fields', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue4_settings_put')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/settings', {
      autoSaveDraft: false,
      diaryReminder: true,
      userId: 'attacker_user_id',
    }, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.autoSaveDraft, false)
    assert.equal(body.data.keepPhotoMood, true)
    assert.equal(body.data.privateMode, true)
    assert.equal(body.data.diaryReminder, true)
    assert.equal(body.data.generationReminder, true)
    assert.equal(body.data.userId, undefined)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/settings rejects non-boolean values', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue4_settings_invalid')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/settings', {
      autoSaveDraft: 'false',
    }, loginData.token)

    assert.equal(response.status, 400)
    assert.notEqual(body.code, 0)
    assert.equal(body.message, '设置字段必须是布尔值')
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('invalid token returns 401', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/users/me', undefined, 'invalid.token.value')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.message, '登录已失效，请重新登录')
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
