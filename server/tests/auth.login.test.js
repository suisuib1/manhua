const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_issue3_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

const { clearCoreTables, prisma } = require('./helpers/testDatabase')
const { app } = require('../src/app')
const { verifyUserToken } = require('../src/utils/jwt')

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server))
    server.on('error', reject)
  })
}

async function postJson(server, path, body) {
  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return {
    response,
    body: await response.json(),
  }
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('non-production mock WeChat login creates a user and returns a business token', async () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevMock = process.env.WECHAT_LOGIN_MOCK
  process.env.NODE_ENV = 'test'
  process.env.WECHAT_LOGIN_MOCK = 'true'

  const server = await listen(app)

  try {
    const { response, body } = await postJson(server, '/api/auth/wechat/login', {
      code: 'test_issue3_new_user',
      profile: {
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.png',
      },
    })

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(typeof body.data.token, 'string')
    assert.equal(Boolean(body.data.user.id), true)
    assert.equal(body.data.user.nickname, '测试用户')
    assert.equal(body.data.user.avatarUrl, 'https://example.com/avatar.png')
    assert.equal(body.data.isNewUser, true)
    assert.equal(body.data.openid, undefined)
    assert.equal(body.data.session_key, undefined)
    assert.equal(body.data.sessionKey, undefined)

    const loaded = await prisma.user.findUnique({
      where: { id: body.data.user.id },
      include: {
        profile: true,
        setting: true,
        comicBooks: true,
        quota: true,
      },
    })

    assert.equal(loaded.wxOpenid, 'mock_openid_test_issue3_new_user')
    assert.equal(loaded.profile.nickname, '测试用户')
    assert.equal(loaded.setting.autoSaveDraft, true)
    assert.equal(loaded.setting.keepPhotoMood, true)
    assert.equal(loaded.setting.privateMode, true)
    assert.equal(loaded.setting.diaryReminder, false)
    assert.equal(loaded.setting.generationReminder, true)
    assert.equal(loaded.comicBooks.length, 1)
    assert.equal(loaded.comicBooks[0].title, '我的漫画日记')
    assert.equal(loaded.quota.totalQuota, 0)
    assert.equal(loaded.quota.usedQuota, 0)
    assert.equal(loaded.quota.remainingQuota, 0)
  } finally {
    process.env.NODE_ENV = prevNodeEnv
    process.env.WECHAT_LOGIN_MOCK = prevMock
    await new Promise((resolve) => server.close(resolve))
  }
})

test('production environment ignores WECHAT_LOGIN_MOCK and uses real provider flow', async () => {
  const prevNodeEnv = process.env.NODE_ENV
  const prevMock = process.env.WECHAT_LOGIN_MOCK
  const prevAppId = process.env.WECHAT_APP_ID
  const prevAppSecret = process.env.WECHAT_APP_SECRET
  const prevFetch = global.fetch
  process.env.NODE_ENV = 'production'
  process.env.WECHAT_LOGIN_MOCK = 'true'
  process.env.WECHAT_APP_ID = 'appid-prod-test'
  process.env.WECHAT_APP_SECRET = 'secret-prod-test'
  global.fetch = async (url, options) => {
    if (String(url).startsWith('http://127.0.0.1:')) {
      return prevFetch(url, options)
    }

    return {
      ok: true,
      json: async () => ({
        openid: 'real_openid_prod_test',
        session_key: 'real_session_key_prod_test',
      }),
    }
  }

  const server = await listen(app)

  try {
    const { response, body } = await postJson(server, '/api/auth/wechat/login', {
      code: 'test_issue3_production',
    })

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(Boolean(body.data.user.id), true)
    assert.equal(body.data.user.nickname, null)
    assert.equal(body.data.user.avatarUrl, null)
    assert.equal(body.data.session_key, undefined)
    assert.equal(body.data.sessionKey, undefined)

    const loaded = await prisma.user.findUnique({
      where: { id: body.data.user.id },
    })
    assert.equal(loaded.wxOpenid, 'real_openid_prod_test')
  } finally {
    global.fetch = prevFetch
    process.env.NODE_ENV = prevNodeEnv
    process.env.WECHAT_LOGIN_MOCK = prevMock
    process.env.WECHAT_APP_ID = prevAppId
    process.env.WECHAT_APP_SECRET = prevAppSecret
    await new Promise((resolve) => server.close(resolve))
  }
})

test('logging in with the same code reuses the same user without duplicate init records', async () => {
  const server = await listen(app)

  try {
    const first = await postJson(server, '/api/auth/wechat/login', {
      code: 'test_issue3_repeat',
      profile: {
        nickname: '第一次昵称',
      },
    })
    const second = await postJson(server, '/api/auth/wechat/login', {
      code: 'test_issue3_repeat',
      profile: {
        nickname: '第二次昵称',
      },
    })

    assert.equal(first.response.status, 200)
    assert.equal(second.response.status, 200)
    assert.equal(first.body.data.user.id, second.body.data.user.id)
    assert.equal(first.body.data.isNewUser, true)
    assert.equal(second.body.data.isNewUser, false)

    const userId = first.body.data.user.id
    assert.equal(await prisma.userProfile.count({ where: { userId } }), 1)
    assert.equal(await prisma.userSetting.count({ where: { userId } }), 1)
    assert.equal(await prisma.comicBook.count({ where: { ownerUserId: userId } }), 1)
    assert.equal(await prisma.userQuota.count({ where: { userId } }), 1)

    const profile = await prisma.userProfile.findUnique({ where: { userId } })
    assert.equal(profile.nickname, '第一次昵称')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('missing login code returns a safe 400 response', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await postJson(server, '/api/auth/wechat/login', {})

    assert.equal(response.status, 400)
    assert.notEqual(body.code, 0)
    assert.equal(body.message, '缺少登录凭证')
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('returned JWT can be verified and only contains the user id subject', async () => {
  const server = await listen(app)

  try {
    const { body } = await postJson(server, '/api/auth/wechat/login', {
      code: 'test_issue3_token',
    })

    const payload = verifyUserToken(body.data.token)

    assert.equal(payload.sub, body.data.user.id)
    assert.equal(payload.wxOpenid, undefined)
    assert.equal(payload.sessionKey, undefined)
    assert.equal(payload.profile, undefined)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
