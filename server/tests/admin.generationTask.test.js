const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_admin_generation_task_jwt_secret'
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

async function createAdminAndToken(server, overrides = {}) {
  await prisma.adminUser.create({
    data: Object.assign({
      username: 'task_admin',
      passwordHash: await hashAdminPassword('task-admin-password'),
      displayName: 'Task Admin',
      status: 'active',
    }, overrides),
  })

  const login = await requestJson(server, 'POST', '/api/admin/auth/login', {
    username: 'task_admin',
    password: 'task-admin-password',
  })

  return login.body.data.token
}

async function loginUser(server, code = 'admin_generation_task_user') {
  const { body } = await requestJson(server, 'POST', '/api/auth/wechat/login', {
    code,
    profile: {
      nickname: `${code}_nickname`,
    },
  })

  return body.data
}

async function createUser(suffix, profile = {}) {
  const user = await prisma.user.create({
    data: {
      wxOpenid: `admin_generation_task_openid_${suffix}`,
      status: 'active',
    },
  })

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      nickname: profile.nickname || `user_${suffix}`,
    },
  })

  return user
}

async function createDiaryEntry(ownerUserId, suffix, overrides = {}) {
  return prisma.diaryEntry.create({
    data: Object.assign({
      ownerUserId,
      chapterTitle: `task_${suffix}_chapter`,
      diaryDate: new Date('2026-05-28T00:00:00.000Z'),
      diaryText: `task_${suffix}_private_diary_text_${'long_text_'.repeat(20)}`,
      pageCount: 1,
      pageMode: 'custom',
      selectedTagsJson: JSON.stringify(['happy']),
      status: 'draft',
    }, overrides),
  })
}

async function createGenerationTask(ownerUserId, diaryEntryId, suffix, overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-05-28T00:00:00.000Z')
  const startedAt = overrides.startedAt === undefined ? createdAt : overrides.startedAt
  const finishedAt = overrides.finishedAt === undefined ? null : overrides.finishedAt
  const result = Object.prototype.hasOwnProperty.call(overrides, 'result')
    ? overrides.result
    : {
        pages: [
          {
            imageUrl: overrides.imageUrl || null,
          },
        ],
      }

  return prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId,
      status: overrides.status || 'pending',
      taskType: 'diary_to_comic',
      promptSnapshot: overrides.promptSnapshot || `prompt_${suffix}_${'safe_prompt_'.repeat(50)}`,
      inputJson: JSON.stringify(overrides.input || { privateInput: `input_${suffix}_should_not_leak` }),
      resultJson: JSON.stringify(result),
      errorMessage: overrides.errorMessage || null,
      startedAt,
      finishedAt,
      createdAt,
    },
  })
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test('GET /api/admin/generation-tasks requires admin token', async () => {
  const server = await listen(app)

  try {
    const missing = await requestJson(server, 'GET', '/api/admin/generation-tasks')
    assert.equal(missing.response.status, 401)
    assert.equal(missing.body.code, 401)

    const userLogin = await loginUser(server)
    const userToken = await requestJson(server, 'GET', '/api/admin/generation-tasks', undefined, userLogin.token)
    assert.equal(userToken.response.status, 401)
    assert.equal(userToken.body.code, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/generation-tasks returns paginated task summaries with filters', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('list', { nickname: '列表用户' })
    const diary = await createDiaryEntry(user.id, 'list')
    const completed = await createGenerationTask(user.id, diary.id, 'completed', {
      status: 'completed',
      imageUrl: '/uploads/generated/completed.png',
      createdAt: new Date('2026-05-28T00:00:03.000Z'),
      startedAt: new Date('2026-05-28T00:00:04.000Z'),
      finishedAt: new Date('2026-05-28T00:00:10.000Z'),
    })
    await createGenerationTask(user.id, diary.id, 'pending', {
      status: 'pending',
      createdAt: new Date('2026-05-28T00:00:02.000Z'),
    })
    await createGenerationTask(user.id, diary.id, 'failed', {
      status: 'failed',
      errorMessage: `failed_${'very_long_error_'.repeat(20)}`,
      createdAt: new Date('2026-05-28T00:00:01.000Z'),
      finishedAt: new Date('2026-05-28T00:00:05.000Z'),
    })

    const pageOne = await requestJson(server, 'GET', '/api/admin/generation-tasks?page=1&pageSize=2', undefined, token)
    assert.equal(pageOne.response.status, 200)
    assert.equal(pageOne.body.code, 0)
    assert.equal(pageOne.body.data.items.length, 2)
    assert.equal(pageOne.body.data.pagination.page, 1)
    assert.equal(pageOne.body.data.pagination.pageSize, 2)
    assert.equal(pageOne.body.data.pagination.total, 3)
    assert.deepEqual(pageOne.body.data.items.map((item) => item.id), [completed.id, pageOne.body.data.items[1].id])

    const first = pageOne.body.data.items[0]
    assert.equal(first.id, completed.id)
    assert.equal(first.diaryEntryId, diary.id)
    assert.equal(first.ownerUserId, user.id)
    assert.equal(first.status, 'completed')
    assert.equal(first.durationMs, 6000)
    assert.equal(first.hasImage, true)
    assert.equal(first.imageUrl, '/uploads/generated/completed.png')
    assert.equal(first.diaryTitle, 'task_list_chapter')
    assert.equal(first.userNickname, '列表用户')
    assert.equal(first.promptSnapshot, undefined)
    assert.equal(first.inputJson, undefined)
    assert.equal(first.resultJson, undefined)

    const statusFiltered = await requestJson(server, 'GET', '/api/admin/generation-tasks?status=completed', undefined, token)
    assert.equal(statusFiltered.body.data.items.length, 1)
    assert.equal(statusFiltered.body.data.items[0].id, completed.id)

    const keywordFiltered = await requestJson(server, 'GET', `/api/admin/generation-tasks?keyword=${diary.id}`, undefined, token)
    assert.equal(keywordFiltered.body.data.items.length, 3)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/generation-tasks returns failed error summary and date filters', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('date')
    const diary = await createDiaryEntry(user.id, 'date')
    await createGenerationTask(user.id, diary.id, 'old', {
      status: 'failed',
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      errorMessage: 'old error',
    })
    const current = await createGenerationTask(user.id, diary.id, 'current', {
      status: 'failed',
      createdAt: new Date('2026-05-28T12:00:00.000Z'),
      errorMessage: `current_${'long_error_'.repeat(30)}`,
    })

    const filtered = await requestJson(
      server,
      'GET',
      '/api/admin/generation-tasks?dateFrom=2026-05-28&dateTo=2026-05-28',
      undefined,
      token,
    )

    assert.equal(filtered.response.status, 200)
    assert.equal(filtered.body.data.items.length, 1)
    assert.equal(filtered.body.data.items[0].id, current.id)
    assert.equal(filtered.body.data.items[0].errorMessage.length <= 120, true)
    assert.equal(filtered.body.data.items[0].hasImage, false)
    assert.equal(filtered.body.data.items[0].imageUrl, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/generation-tasks/:id returns safe detail for admin', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const user = await createUser('detail', { nickname: '详情用户' })
    const diary = await createDiaryEntry(user.id, 'detail', {
      diaryText: `detail_private_text_${'long_diary_'.repeat(80)}`,
    })
    const task = await createGenerationTask(user.id, diary.id, 'detail', {
      status: 'failed',
      promptSnapshot: `prompt with Authorization Bearer secret-token OPENAI_API_KEY ${process.cwd()} ${'prompt_text_'.repeat(500)}`,
      input: {
        diaryEntryId: diary.id,
        chapterTitle: 'task_detail_chapter',
        sensitive: `Authorization Bearer input-token OPENAI_API_KEY ${process.cwd()}`,
      },
      result: {
        pages: [
          {
            imageUrl: null,
            note: `Bearer result-token ${process.cwd()}`,
          },
        ],
      },
      errorMessage: 'detail failed error',
      startedAt: new Date('2026-05-28T00:00:01.000Z'),
      finishedAt: new Date('2026-05-28T00:00:03.000Z'),
    })

    const detail = await requestJson(server, 'GET', `/api/admin/generation-tasks/${task.id}`, undefined, token)

    assert.equal(detail.response.status, 200)
    assert.equal(detail.body.code, 0)
    assert.equal(detail.body.data.id, task.id)
    assert.equal(detail.body.data.diaryEntryId, diary.id)
    assert.equal(detail.body.data.ownerUserId, user.id)
    assert.equal(detail.body.data.status, 'failed')
    assert.equal(detail.body.data.durationMs, 2000)
    assert.deepEqual(detail.body.data.input, {
      diaryEntryId: diary.id,
      chapterTitle: 'task_detail_chapter',
      sensitive: '[redacted-header] Bearer [redacted] [redacted-env] [redacted-path]',
    })
    assert.equal(detail.body.data.result.pages[0].imageUrl, null)
    assert.equal(detail.body.data.result.pages[0].note, 'Bearer [redacted] [redacted-path]')
    assert.equal(detail.body.data.promptSnapshot.length <= 4000, true)
    assert.equal(detail.body.data.diary.id, diary.id)
    assert.equal(detail.body.data.diary.title, 'task_detail_chapter')
    assert.equal(detail.body.data.diary.content.length <= 160, true)
    assert.equal(detail.body.data.diary.mood, 'happy')
    assert.equal(detail.body.data.user.id, user.id)
    assert.equal(detail.body.data.user.nickname, '详情用户')

    const serialized = JSON.stringify(detail.body.data)
    assert.equal(serialized.includes('passwordHash'), false)
    assert.equal(serialized.includes('secret-token'), false)
    assert.equal(serialized.includes('OPENAI_API_KEY'), false)
    assert.equal(serialized.includes('Authorization'), false)
    assert.equal(serialized.includes(process.cwd()), false)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('GET /api/admin/generation-tasks/:id returns 404 for missing task', async () => {
  const server = await listen(app)

  try {
    const token = await createAdminAndToken(server)
    const { response, body } = await requestJson(server, 'GET', '/api/admin/generation-tasks/missing-task-id', undefined, token)

    assert.equal(response.status, 404)
    assert.notEqual(body.code, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
