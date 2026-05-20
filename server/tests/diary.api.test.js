const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_issue7_jwt_secret'
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
    chapterTitle: `test_issue7_${suffix}_chapter`,
    diaryDate: '2026-05-20',
    diaryText: `test_issue7_${suffix}_text`,
    pageCount: 4,
    pageMode: 'continuous',
    selectedTags: ['开心', '日常'],
    photos: [
      {
        imageUrl: `wxfile://test_issue7_${suffix}.jpg`,
        originalName: `${suffix}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 123456,
        sortOrder: 0,
      },
    ],
  }
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('POST /api/diary-entries requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'POST', '/api/diary-entries', createPayload())

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('logged in user can create a diary entry with selectedTags and photos', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue7_create')
    const { response, body } = await requestJson(server, 'POST', '/api/diary-entries', createPayload(), loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.chapterTitle, 'test_issue7_one_chapter')
    assert.deepEqual(body.data.selectedTags, ['开心', '日常'])
    assert.equal(body.data.selectedTagsJson, undefined)
    assert.equal(body.data.photos.length, 1)
    assert.equal(body.data.photos[0].imageUrl, 'wxfile://test_issue7_one.jpg')

    const entry = await prisma.diaryEntry.findUnique({ where: { id: body.data.id } })
    assert.equal(entry.ownerUserId, loginData.user.id)
    assert.equal(entry.selectedTagsJson, JSON.stringify(['开心', '日常']))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/diary-entries only returns current user entries', async () => {
  const server = await listen(app)

  try {
    const userA = await login(server, 'test_issue7_user_a')
    const userB = await login(server, 'test_issue7_user_b')

    await requestJson(server, 'POST', '/api/diary-entries', createPayload('a'), userA.token)
    await requestJson(server, 'POST', '/api/diary-entries', createPayload('b'), userB.token)

    const { response, body } = await requestJson(server, 'GET', '/api/diary-entries', undefined, userA.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.items.length, 1)
    assert.equal(body.data.items[0].chapterTitle, 'test_issue7_a_chapter')
    assert.deepEqual(body.data.items[0].selectedTags, ['开心', '日常'])
    assert.equal(body.data.pagination.total, 1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/diary-entries/:id returns detail with photos', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue7_detail')
    const created = await requestJson(server, 'POST', '/api/diary-entries', createPayload('detail'), loginData.token)

    const { response, body } = await requestJson(server, 'GET', `/api/diary-entries/${created.body.data.id}`, undefined, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.id, created.body.data.id)
    assert.equal(body.data.photos.length, 1)
    assert.deepEqual(body.data.selectedTags, ['开心', '日常'])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('PUT /api/diary-entries/:id updates text tags and replaces photos without overposting', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue7_update')
    const created = await requestJson(server, 'POST', '/api/diary-entries', createPayload('update'), loginData.token)

    const { response, body } = await requestJson(server, 'PUT', `/api/diary-entries/${created.body.data.id}`, {
      chapterTitle: 'test_issue7_updated_title',
      diaryText: 'test_issue7_updated_text',
      selectedTags: ['更新'],
      ownerUserId: 'attacker',
      status: 'completed',
      deletedAt: '2026-05-20T00:00:00.000Z',
      photos: [
        {
          imageUrl: 'wxfile://test_issue7_new.jpg',
          sortOrder: 2,
        },
      ],
    }, loginData.token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.chapterTitle, 'test_issue7_updated_title')
    assert.equal(body.data.diaryText, 'test_issue7_updated_text')
    assert.deepEqual(body.data.selectedTags, ['更新'])
    assert.equal(body.data.status, 'draft')
    assert.equal(body.data.photos.length, 1)
    assert.equal(body.data.photos[0].imageUrl, 'wxfile://test_issue7_new.jpg')

    const entry = await prisma.diaryEntry.findUnique({ where: { id: created.body.data.id } })
    assert.equal(entry.ownerUserId, loginData.user.id)
    assert.equal(entry.status, 'draft')
    assert.equal(entry.deletedAt, null)
    assert.equal(await prisma.diaryPhoto.count({
      where: {
        diaryEntryId: created.body.data.id,
        deletedAt: null,
      },
    }), 1)
    assert.equal(await prisma.diaryPhoto.count({
      where: {
        diaryEntryId: created.body.data.id,
        deletedAt: { not: null },
      },
    }), 1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('DELETE /api/diary-entries/:id soft deletes entry and photos', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue7_delete')
    const created = await requestJson(server, 'POST', '/api/diary-entries', createPayload('delete'), loginData.token)

    const deleted = await requestJson(server, 'DELETE', `/api/diary-entries/${created.body.data.id}`, undefined, loginData.token)
    const detail = await requestJson(server, 'GET', `/api/diary-entries/${created.body.data.id}`, undefined, loginData.token)

    assert.equal(deleted.response.status, 200)
    assert.deepEqual(deleted.body.data, { deleted: true })
    assert.equal(detail.response.status, 404)

    const entry = await prisma.diaryEntry.findUnique({ where: { id: created.body.data.id } })
    assert.equal(Boolean(entry.deletedAt), true)
    const photo = await prisma.diaryPhoto.findFirst({ where: { diaryEntryId: created.body.data.id } })
    assert.equal(Boolean(photo.deletedAt), true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('user cannot access another user diary entry', async () => {
  const server = await listen(app)

  try {
    const userA = await login(server, 'test_issue7_owner_a')
    const userB = await login(server, 'test_issue7_owner_b')
    const created = await requestJson(server, 'POST', '/api/diary-entries', createPayload('owner'), userA.token)

    const { response, body } = await requestJson(server, 'GET', `/api/diary-entries/${created.body.data.id}`, undefined, userB.token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('invalid diary payload returns 400', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue7_invalid')

    const invalidTags = await requestJson(server, 'POST', '/api/diary-entries', {
      selectedTags: '开心',
    }, loginData.token)
    const invalidPageCount = await requestJson(server, 'POST', '/api/diary-entries', {
      pageCount: 99,
    }, loginData.token)

    assert.equal(invalidTags.response.status, 400)
    assert.equal(invalidTags.body.data, null)
    assert.equal(invalidPageCount.response.status, 400)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
