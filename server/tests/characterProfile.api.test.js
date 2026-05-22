const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_character_profile_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

const { clearCoreTables, prisma } = require('./helpers/testDatabase')
const { app } = require('../src/app')

const defaultCharacterProfile = {
  nickname: '',
  roleTitle: '默认漫画书主角',
  description: '',
  personalityText: '',
  appearanceText: '',
  referenceImageUrl: '',
}

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

async function login(server, code) {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
    profile: {
      nickname: `${code}_user`,
    },
  })

  return body.data
}

function createPayload(suffix = 'one') {
  return {
    nickname: `小满_${suffix}`,
    roleTitle: '默认漫画书主角',
    description: `暖色外套和圆眼睛_${suffix}`,
    personalityText: `温柔 好奇_${suffix}`,
    appearanceText: `短发 发夹_${suffix}`,
    referenceImageUrl: `https://example.com/reference-${suffix}.png`,
  }
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/users/me/character-profile requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/users/me/character-profile')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', createPayload())

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/users/me/character-profile returns default profile when none exists', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_default')
    const { response, body } = await requestJson(server, 'GET', '/api/users/me/character-profile', undefined, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.deepEqual(body.data, defaultCharacterProfile)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile creates a profile for current user', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_create')
    const payload = createPayload('create')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', payload, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.deepEqual(body.data, payload)
    assert.equal(body.data.id, undefined)
    assert.equal(body.data.ownerUserId, undefined)
    assert.equal(body.data.createdAt, undefined)
    assert.equal(body.data.updatedAt, undefined)

    const profile = await prisma.characterProfile.findUnique({
      where: { ownerUserId: loginData.user.id },
    })
    assert.equal(profile.ownerUserId, loginData.user.id)
    assert.equal(profile.nickname, payload.nickname)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile updates a profile and keeps omitted fields', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_update')
    const created = createPayload('before')
    await requestJson(server, 'PUT', '/api/users/me/character-profile', created, loginData.token)

    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', {
      nickname: '更新后的小满',
      personalityText: '勇敢 安静',
    }, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.nickname, '更新后的小满')
    assert.equal(body.data.personalityText, '勇敢 安静')
    assert.equal(body.data.roleTitle, created.roleTitle)
    assert.equal(body.data.description, created.description)
    assert.equal(body.data.appearanceText, created.appearanceText)
    assert.equal(body.data.referenceImageUrl, created.referenceImageUrl)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile ignores overposting fields', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_overposting')
    const payload = Object.assign(createPayload('safe'), {
      id: 'attacker_profile_id',
      ownerUserId: 'attacker_user_id',
      userId: 'attacker_user_id',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
    })
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', payload, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.id, undefined)
    assert.equal(body.data.ownerUserId, undefined)
    assert.equal(body.data.userId, undefined)
    assert.equal(body.data.createdAt, undefined)
    assert.equal(body.data.updatedAt, undefined)

    const profile = await prisma.characterProfile.findUnique({
      where: { ownerUserId: loginData.user.id },
    })
    assert.equal(profile.ownerUserId, loginData.user.id)
    assert.notEqual(profile.id, 'attacker_profile_id')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile rejects non-string fields', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_invalid_type')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', {
      personalityText: ['温柔'],
    }, loginData.token)

    assert.equal(response.status, 400)
    assert.notEqual(body.code, 0)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/users/me/character-profile rejects local temporary reference image urls', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_character_profile_local_image')
    const { response, body } = await requestJson(server, 'PUT', '/api/users/me/character-profile', {
      referenceImageUrl: 'wxfile://tmp_reference.png',
    }, loginData.token)

    assert.equal(response.status, 400)
    assert.notEqual(body.code, 0)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/users/me/character-profile only returns current user profile', async () => {
  const server = await listen(app)

  try {
    const userA = await login(server, 'test_character_profile_user_a')
    const userB = await login(server, 'test_character_profile_user_b')
    const payloadA = createPayload('owner_a')
    await requestJson(server, 'PUT', '/api/users/me/character-profile', payloadA, userA.token)

    const { response, body } = await requestJson(server, 'GET', '/api/users/me/character-profile', undefined, userB.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.deepEqual(body.data, defaultCharacterProfile)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
