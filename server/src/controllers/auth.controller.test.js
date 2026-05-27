const assert = require('node:assert/strict')
const test = require('node:test')

function snapshotModules(paths) {
  return paths.map((path) => [path, require.cache[path]])
}

function restoreModules(snapshot) {
  snapshot.forEach(([path, entry]) => {
    if (entry) {
      require.cache[path] = entry
    } else {
      delete require.cache[path]
    }
  })
}

function loadAuthController({ code2sessionImpl, findOrCreateImpl, signUserTokenImpl }) {
  const wechatAuthPath = require.resolve('../services/wechatAuth.service')
  const userInitPath = require.resolve('../services/userInit.service')
  const jwtPath = require.resolve('../utils/jwt')
  const controllerPath = require.resolve('./auth.controller')
  const moduleSnapshot = snapshotModules([wechatAuthPath, userInitPath, jwtPath, controllerPath])

  delete require.cache[controllerPath]
  require.cache[wechatAuthPath] = {
    id: wechatAuthPath,
    filename: wechatAuthPath,
    loaded: true,
    exports: {
      code2session: code2sessionImpl,
    },
  }
  require.cache[userInitPath] = {
    id: userInitPath,
    filename: userInitPath,
    loaded: true,
    exports: {
      findOrCreateUserByWechatIdentity: findOrCreateImpl,
    },
  }
  require.cache[jwtPath] = {
    id: jwtPath,
    filename: jwtPath,
    loaded: true,
    exports: {
      signUserToken: signUserTokenImpl || (() => 'jwt-token'),
    },
  }

  return {
    controller: require('./auth.controller'),
    restore() {
      restoreModules(moduleSnapshot)
    },
  }
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

test('真实微信 openid 登录成功时返回现有 token/user/isNewUser 结构且不暴露敏感字段', async () => {
  const calls = []
  const { controller, restore } = loadAuthController({
    code2sessionImpl: async () => ({
      openid: 'openid-real-user',
      unionid: 'union-real-user',
      session_key: 'sensitive-session-key',
    }),
    findOrCreateImpl: async (identity) => {
      calls.push(identity)
      return {
        isNewUser: true,
        user: {
          id: 'user-1',
          profile: {
            nickname: '小满',
            avatarUrl: '/avatar.png',
          },
        },
      }
    },
  })

  try {
    const res = createResponse()
    await controller.loginWithWechat({
      body: {
        code: 'real-code',
        profile: {},
      },
    }, res, assert.fail)

    assert.deepEqual(calls, [{
      openid: 'openid-real-user',
      unionid: 'union-real-user',
      profile: {},
    }])
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.code, 0)
    assert.equal(res.body.data.token, 'jwt-token')
    assert.equal(res.body.data.user.id, 'user-1')
    assert.equal(res.body.data.user.nickname, '小满')
    assert.equal(res.body.data.isNewUser, true)
    assert.equal(JSON.stringify(res.body).includes('session_key'), false)
    assert.equal(JSON.stringify(res.body).includes('sensitive-session-key'), false)
    assert.equal(JSON.stringify(res.body).includes('openid-real-user'), false)
  } finally {
    restore()
  }
})

test('同一个 openid 二次登录不会创建新用户，由 findOrCreate 返回同一 user', async () => {
  const userStore = new Map()
  let createCount = 0
  const { controller, restore } = loadAuthController({
    code2sessionImpl: async () => ({
      openid: 'openid-same-user',
      unionid: null,
    }),
    findOrCreateImpl: async ({ openid }) => {
      if (userStore.has(openid)) {
        return {
          isNewUser: false,
          user: userStore.get(openid),
        }
      }

      createCount += 1
      const user = {
        id: 'user-stable',
        profile: {
          nickname: null,
          avatarUrl: null,
        },
      }
      userStore.set(openid, user)
      return {
        isNewUser: true,
        user,
      }
    },
  })

  try {
    const firstResponse = createResponse()
    const secondResponse = createResponse()
    await controller.loginWithWechat({ body: { code: 'first-code' } }, firstResponse, assert.fail)
    await controller.loginWithWechat({ body: { code: 'second-code' } }, secondResponse, assert.fail)

    assert.equal(createCount, 1)
    assert.equal(firstResponse.body.data.user.id, 'user-stable')
    assert.equal(secondResponse.body.data.user.id, 'user-stable')
    assert.equal(firstResponse.body.data.isNewUser, true)
    assert.equal(secondResponse.body.data.isNewUser, false)
  } finally {
    restore()
  }
})

test('code2Session 失败时不会创建用户', async () => {
  let createCalled = false
  const expectedError = new Error('微信登录凭证无效')
  expectedError.status = 401
  expectedError.code = 40101

  const { controller, restore } = loadAuthController({
    code2sessionImpl: async () => {
      throw expectedError
    },
    findOrCreateImpl: async () => {
      createCalled = true
      throw new Error('should not create user')
    },
  })

  try {
    let nextError = null
    await controller.loginWithWechat({ body: { code: 'bad-code' } }, createResponse(), (error) => {
      nextError = error
    })

    assert.equal(createCalled, false)
    assert.equal(nextError, expectedError)
  } finally {
    restore()
  }
})
