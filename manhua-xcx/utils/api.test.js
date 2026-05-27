const assert = require('node:assert/strict')
const test = require('node:test')

function loadApi(storage = {}, requestImpl) {
  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    request: requestImpl,
  }

  delete require.cache[require.resolve('./api')]
  return require('./api')
}

test('request adds Authorization header when auth is true', async () => {
  let requestOptions
  const { request } = loadApi({ authToken: 'token-1' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: { ok: true },
      },
    })
  })

  const data = await request({
    url: '/api/users/me',
    method: 'GET',
    auth: true,
  })

  assert.deepEqual(data, { ok: true })
  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/users/me')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-1')
})

test('request rejects backend non-zero code', async () => {
  const { request } = loadApi({}, (options) => {
    options.success({
      statusCode: 400,
      data: {
        code: 40001,
        message: 'bad request',
        data: null,
      },
    })
  })

  await assert.rejects(
    request({
      url: '/api/auth/wechat/login',
      method: 'POST',
      data: { code: '' },
    }),
    /bad request/
  )
})

test('request rejects network failure with simplified Chinese message', async () => {
  const { request } = loadApi({}, (options) => {
    options.fail({})
  })

  await assert.rejects(
    request({
      url: '/api/auth/wechat/login',
      method: 'POST',
      data: { code: 'login_code' },
    }),
    /网络连接失败，请检查服务是否已启动/
  )
})
