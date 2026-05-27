const assert = require('node:assert/strict')
const test = require('node:test')

function loadWechatAuthService() {
  delete require.cache[require.resolve('./wechatAuth.service')]
  return require('./wechatAuth.service')
}

function snapshotEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    WECHAT_LOGIN_MOCK: process.env.WECHAT_LOGIN_MOCK,
    WECHAT_APP_ID: process.env.WECHAT_APP_ID,
    WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET,
  }
}

function restoreEnv(snapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  })
  delete require.cache[require.resolve('./wechatAuth.service')]
}

test('WECHAT_LOGIN_MOCK=true 时仍走 mock 登录', async () => {
  const env = snapshotEnv()

  try {
    process.env.NODE_ENV = 'development'
    process.env.WECHAT_LOGIN_MOCK = 'true'

    const { code2session } = loadWechatAuthService()
    const identity = await code2session('mock-code')

    assert.equal(identity.openid, 'mock_openid_mock-code')
    assert.equal(identity.unionid, null)
  } finally {
    restoreEnv(env)
  }
})

test('WECHAT_LOGIN_MOCK=false 但缺少微信配置时返回安全错误', async () => {
  const env = snapshotEnv()

  try {
    process.env.NODE_ENV = 'development'
    process.env.WECHAT_LOGIN_MOCK = 'false'
    delete process.env.WECHAT_APP_ID
    delete process.env.WECHAT_APP_SECRET

    const { code2session } = loadWechatAuthService()

    await assert.rejects(
      () => code2session('real-code'),
      (error) => {
        assert.equal(error.status, 500)
        assert.equal(error.code, 50002)
        assert.equal(String(error.message).includes('AppSecret'), false)
        return true
      },
    )
  } finally {
    restoreEnv(env)
  }
})

test('WECHAT_LOGIN_MOCK=false 且微信返回 openid 时只返回安全身份字段', async () => {
  const env = snapshotEnv()
  const originalFetch = global.fetch
  const requests = []

  try {
    process.env.NODE_ENV = 'development'
    process.env.WECHAT_LOGIN_MOCK = 'false'
    process.env.WECHAT_APP_ID = 'wx-test-app'
    process.env.WECHAT_APP_SECRET = 'secret-for-test'

    global.fetch = async (url) => {
      requests.push(String(url))
      return {
        ok: true,
        async json() {
          return {
            openid: 'openid-real-user',
            unionid: 'union-real-user',
            session_key: 'sensitive-session-key',
          }
        },
      }
    }

    const { code2session } = loadWechatAuthService()
    const identity = await code2session('real-code')

    assert.equal(identity.openid, 'openid-real-user')
    assert.equal(identity.unionid, 'union-real-user')
    assert.equal(Object.prototype.hasOwnProperty.call(identity, 'session_key'), false)
    assert.equal(requests[0].includes('appid=wx-test-app'), true)
    assert.equal(requests[0].includes('secret=secret-for-test'), true)
    assert.equal(requests[0].includes('js_code=real-code'), true)
  } finally {
    global.fetch = originalFetch
    restoreEnv(env)
  }
})

test('code2Session 返回 errcode 时不会暴露微信原始敏感响应', async () => {
  const env = snapshotEnv()
  const originalFetch = global.fetch

  try {
    process.env.NODE_ENV = 'development'
    process.env.WECHAT_LOGIN_MOCK = 'false'
    process.env.WECHAT_APP_ID = 'wx-test-app'
    process.env.WECHAT_APP_SECRET = 'secret-for-test'

    global.fetch = async () => ({
      ok: true,
      async json() {
        return {
          errcode: 40029,
          errmsg: 'invalid code, rid: sensitive-rid',
          session_key: 'sensitive-session-key',
        }
      },
    })

    const { code2session } = loadWechatAuthService()

    await assert.rejects(
      () => code2session('bad-code'),
      (error) => {
        assert.equal(error.status, 401)
        assert.equal(error.code, 40101)
        assert.equal(String(error.message).includes('sensitive-rid'), false)
        assert.equal(String(error.message).includes('session_key'), false)
        assert.equal(String(error.message).includes('secret-for-test'), false)
        return true
      },
    )
  } finally {
    global.fetch = originalFetch
    restoreEnv(env)
  }
})
