const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_auth_jwt_secret'
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

async function createAdmin(overrides = {}) {
  return prisma.adminUser.create({
    data: Object.assign({
      username: 'admin',
      passwordHash: await hashAdminPassword('correct-password'),
      displayName: 'Admin User',
      status: 'active',
    }, overrides),
  })
}

async function loginUser(server, code = 'admin_auth_user_token') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
  })

  return body.data
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('POST /api/admin/auth/login fails when admin does not exist', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'POST', '/api/admin/auth/login', {
      username: 'missing',
      password: 'correct-password',
    })

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/admin/auth/login fails with a wrong password', async () => {
  const server = await listen(app)

  try {
    await createAdmin()
    const { response, body } = await requestJson(server, 'POST', '/api/admin/auth/login', {
      username: 'admin',
      password: 'wrong-password',
    })

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/admin/auth/login rejects disabled admin', async () => {
  const server = await listen(app)

  try {
    await createAdmin({ status: 'disabled' })
    const { response, body } = await requestJson(server, 'POST', '/api/admin/auth/login', {
      username: 'admin',
      password: 'correct-password',
    })

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('POST /api/admin/auth/login returns admin token without password hash and updates lastLoginAt', async () => {
  const server = await listen(app)

  try {
    const admin = await createAdmin()
    assert.equal(admin.lastLoginAt, null)

    const { response, body } = await requestJson(server, 'POST', '/api/admin/auth/login', {
      username: 'admin',
      password: 'correct-password',
    })

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(typeof body.data.token, 'string')
    assert.equal(body.data.admin.id, admin.id)
    assert.equal(body.data.admin.username, 'admin')
    assert.equal(body.data.admin.displayName, 'Admin User')
    assert.equal(body.data.admin.passwordHash, undefined)
    assert.equal(JSON.stringify(body.data).includes('correct-password'), false)
    assert.equal(JSON.stringify(body.data).includes(admin.passwordHash), false)

    const updated = await prisma.adminUser.findUnique({ where: { id: admin.id } })
    assert.notEqual(updated.lastLoginAt, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/me requires an admin token', async () => {
  const server = await listen(app)

  try {
    await createAdmin()

    const missing = await requestJson(server, 'GET', '/api/admin/me')
    assert.equal(missing.response.status, 401)
    assert.equal(missing.body.code, 401)

    const userLogin = await loginUser(server)
    const userToken = await requestJson(server, 'GET', '/api/admin/me', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/me returns current admin and rejects disabled admin token', async () => {
  const server = await listen(app)

  try {
    const admin = await createAdmin()
    const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
      username: 'admin',
      password: 'correct-password',
    })

    const me = await requestJson(server, 'GET', '/api/admin/me', undefined, login.body.data.token)
    assert.equal(me.response.status, 200)
    assert.equal(me.body.code, 0)
    assert.equal(me.body.data.id, admin.id)
    assert.equal(me.body.data.username, 'admin')
    assert.equal(me.body.data.displayName, 'Admin User')
    assert.equal(me.body.data.passwordHash, undefined)

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { status: 'disabled' },
    })

    const disabled = await requestJson(server, 'GET', '/api/admin/me', undefined, login.body.data.token)
    assert.equal(disabled.response.status, 401)
    assert.equal(disabled.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
