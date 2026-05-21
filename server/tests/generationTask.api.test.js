const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_generation_task_jwt_secret'
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

async function createDiaryEntry(ownerUserId, suffix = 'one') {
  return prisma.diaryEntry.create({
    data: {
      ownerUserId,
      chapterTitle: `generation_task_${suffix}_chapter`,
      diaryDate: new Date('2026-05-21T00:00:00.000Z'),
      diaryText: `generation_task_${suffix}_diary_text`,
      pageCount: 3,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['daily', 'cute']),
      status: 'draft',
    },
  })
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('POST /api/generation-tasks requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: 'diary-entry-id',
    })

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('logged in user can create and read a completed mock generation task', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_owner')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'owned')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(created.response.status, 200)
    assert.equal(created.body.code, 0)
    assert.equal(created.body.data.status, 'completed')
    assert.equal(created.body.data.taskType, 'diary_to_comic')
    assert.equal(created.body.data.diaryEntryId, diaryEntry.id)
    assert.equal(created.body.data.ownerUserId, undefined)
    assert.equal(created.body.data.input.diaryEntryId, diaryEntry.id)
    assert.equal(created.body.data.input.chapterTitle, 'generation_task_owned_chapter')
    assert.equal(Array.isArray(created.body.data.result.pages), true)
    assert.equal(created.body.data.result.pages.length, 1)
    assert.equal(created.body.data.result.pages[0].mock, true)

    const foundTask = await prisma.generationTask.findUnique({
      where: {
        id: created.body.data.id,
      },
    })
    assert.equal(foundTask.ownerUserId, loginData.user.id)
    assert.equal(foundTask.status, 'completed')

    const detail = await requestJson(server, 'GET', `/api/generation-tasks/${created.body.data.id}`, undefined, loginData.token)

    assert.equal(detail.response.status, 200)
    assert.deepEqual(detail.body.data, created.body.data)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('user cannot create generation task from another user diary entry', async () => {
  const server = await listen(app)

  try {
    const owner = await login(server, 'generation_task_entry_owner')
    const attacker = await login(server, 'generation_task_attacker')
    const diaryEntry = await createDiaryEntry(owner.user.id, 'private')

    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, attacker.token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
    assert.equal(await prisma.generationTask.count(), 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('user cannot read another user generation task', async () => {
  const server = await listen(app)

  try {
    const owner = await login(server, 'generation_task_read_owner')
    const attacker = await login(server, 'generation_task_reader')
    const diaryEntry = await createDiaryEntry(owner.user.id, 'read')

    const created = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, owner.token)
    const detail = await requestJson(server, 'GET', `/api/generation-tasks/${created.body.data.id}`, undefined, attacker.token)

    assert.equal(detail.response.status, 404)
    assert.notEqual(detail.body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('deleted diary entry cannot create generation task', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'generation_task_deleted_entry')
    const diaryEntry = await createDiaryEntry(loginData.user.id, 'deleted')
    await prisma.diaryEntry.update({
      where: {
        id: diaryEntry.id,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    const { response, body } = await requestJson(server, 'POST', '/api/generation-tasks', {
      diaryEntryId: diaryEntry.id,
    }, loginData.token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
    assert.equal(await prisma.generationTask.count(), 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
