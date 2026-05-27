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
  delete require.cache[require.resolve('./comicChapterApi')]
  return require('./comicChapterApi')
}

test('getRecentComicChapters calls recent endpoint with auth', async () => {
  let requestOptions
  const { getRecentComicChapters } = loadApi({ authToken: 'token-recent' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-1',
              title: '最近章节',
            },
          ],
        },
      },
    })
  })

  const data = await getRecentComicChapters()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/comic-chapters/recent')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-recent')
  assert.equal(data.items[0].id, 'entry-1')
})

test('getRecentComicChapters passes limit as query data', async () => {
  let requestOptions
  const { getRecentComicChapters } = loadApi({ authToken: 'token-recent' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  await getRecentComicChapters({ limit: 3 })

  assert.deepEqual(requestOptions.data, {
    limit: 3,
  })
})

test('getComicChapterStats calls stats endpoint with auth', async () => {
  let requestOptions
  const { getComicChapterStats } = loadApi({ authToken: 'token-stats' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          totalChapters: 3,
          completedChapters: 1,
          generatingChapters: 1,
        },
      },
    })
  })

  const data = await getComicChapterStats()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/comic-chapters/stats')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-stats')
  assert.deepEqual(data, {
    totalChapters: 3,
    completedChapters: 1,
    generatingChapters: 1,
  })
})
