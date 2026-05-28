const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_dashboard_jwt_secret'
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
      username: 'dashboard_admin',
      passwordHash: await hashAdminPassword('dashboard-password'),
      displayName: 'Dashboard Admin',
      status: 'active',
    },
  })

  const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
    username: 'dashboard_admin',
    password: 'dashboard-password',
  })

  return login.body.data.token
}

async function createUser(suffix, createdAt) {
  return prisma.user.create({
    data: {
      wxOpenid: `dashboard_openid_${suffix}`,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    },
  })
}

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `dashboard_${suffix}_chapter`,
      diaryDate: new Date('2026-05-28T00:00:00.000Z'),
      diaryText: `dashboard_${suffix}_diary`,
      pageCount: 1,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['daily']),
      status: 'draft',
    }, overrides),
  })
}

async function createGenerationTask(ownerUserId, diaryEntryId, suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  return prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId,
      status: overrides.status || 'pending',
      taskType: 'diary_to_comic',
      promptSnapshot: `prompt_${suffix}_should_not_leak`,
      inputJson: JSON.stringify({ privateInput: `input_${suffix}_should_not_leak` }),
      resultJson: overrides.resultJson || null,
      errorMessage: overrides.errorMessage || null,
      startedAt: createdAt,
      finishedAt: overrides.finishedAt || null,
      createdAt,
    },
  })
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/admin/dashboard requires admin token', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await requestJson(server, 'GET', '/api/admin/dashboard')

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/dashboard returns aggregate counts and safe recent failed tasks', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const today = new Date()
    const todayUser = await createUser('today', today)
    const oldUser = await createUser('old', new Date('2026-05-20T00:00:00.000Z'))

    const activeEntry = await createDiaryEntry(todayUser.id, 'active')
    await createDiaryEntry(todayUser.id, 'deleted', {
      deletedAt: new Date('2026-05-28T01:00:00.000Z'),
    })
    const otherEntry = await createDiaryEntry(oldUser.id, 'other')

    await createGenerationTask(todayUser.id, activeEntry.id, 'pending', { status: 'pending' })
    await createGenerationTask(todayUser.id, activeEntry.id, 'processing', { status: 'processing' })
    await createGenerationTask(todayUser.id, activeEntry.id, 'completed', { status: 'completed' })
    const olderFailed = await createGenerationTask(oldUser.id, otherEntry.id, 'failed_old', {
      status: 'failed',
      errorMessage: 'older failed message should be visible as a short summary',
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
      finishedAt: new Date('2026-05-28T00:00:02.000Z'),
    })

    const failedTasks = []
    for (let index = 0; index < 6; index += 1) {
      failedTasks.push(await createGenerationTask(todayUser.id, activeEntry.id, `failed_${index}`, {
        status: 'failed',
        errorMessage: `failed_${index}_${'long_error_'.repeat(30)}`,
        createdAt: new Date(`2026-05-28T00:00:${10 + index}.000Z`),
        finishedAt: new Date(`2026-05-28T00:01:${10 + index}.000Z`),
      }))
    }

    const { response, body } = await requestJson(server, 'GET', '/api/admin/dashboard', undefined, token)

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.userCount, 2)
    assert.equal(body.data.todayNewUserCount, 1)
    assert.equal(body.data.diaryEntryCount, 2)
    assert.equal(body.data.generationTaskCount, 10)
    assert.deepEqual(body.data.generationTaskStatusCounts, {
      pending: 1,
      processing: 1,
      completed: 1,
      failed: 7,
    })
    assert.equal(body.data.recentFailedTasks.length, 5)
    assert.deepEqual(
      body.data.recentFailedTasks.map((item) => item.taskId),
      failedTasks.slice(1).reverse().map((task) => task.id),
    )
    assert.equal(body.data.recentFailedTasks.some((item) => item.taskId === olderFailed.id), false)

    const item = body.data.recentFailedTasks[0]
    assert.equal(item.diaryEntryId, activeEntry.id)
    assert.equal(item.status, 'failed')
    assert.equal(typeof item.errorMessage, 'string')
    assert.equal(item.errorMessage.length <= 120, true)
    assert.equal(Boolean(item.createdAt), true)
    assert.equal(Boolean(item.finishedAt), true)
    assert.equal(item.promptSnapshot, undefined)
    assert.equal(item.inputJson, undefined)
    assert.equal(item.resultJson, undefined)
    assert.equal(JSON.stringify(body.data).includes('prompt_failed'), false)
    assert.equal(JSON.stringify(body.data).includes('input_failed'), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
