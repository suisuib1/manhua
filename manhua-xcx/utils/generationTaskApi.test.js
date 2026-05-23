const assert = require('node:assert/strict')
const test = require('node:test')

function loadApi(storage = {}, requestImpl) {
  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    request(options) {
      requestImpl(options)
    },
  }

  delete require.cache[require.resolve('./api')]
  delete require.cache[require.resolve('./generationTaskApi')]
  return require('./generationTaskApi')
}

test('createGenerationTask posts diaryEntryId with auth', async () => {
  let requestOptions
  const { createGenerationTask } = loadApi({ authToken: 'token-task' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-1',
          status: 'completed',
        },
      },
    })
  })

  const task = await createGenerationTask('entry-1')

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/generation-tasks')
  assert.equal(requestOptions.method, 'POST')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-task')
  assert.equal(requestOptions.timeout, 120000)
  assert.deepEqual(requestOptions.data, {
    diaryEntryId: 'entry-1',
  })
  assert.equal(task.id, 'task-1')
  assert.equal(task.status, 'completed')
})

test('createGenerationTask rejects backend errors for fallback handling', async () => {
  const { createGenerationTask } = loadApi({ authToken: 'token-task' }, (options) => {
    options.success({
      statusCode: 500,
      data: {
        code: 500,
        message: 'generation failed',
        data: null,
      },
    })
  })

  await assert.rejects(
    createGenerationTask('entry-1'),
    /generation failed/
  )
})

test('createGenerationTask requires diaryEntryId', async () => {
  const { createGenerationTask } = loadApi({ authToken: 'token-task' }, () => {
    throw new Error('request should not be called')
  })

  await assert.rejects(
    createGenerationTask(''),
    /diaryEntryId/
  )
})
