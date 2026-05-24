const assert = require('node:assert/strict')
const test = require('node:test')

function loadApi(requestImpl) {
  global.wx = {
    getStorageSync() {
      return ''
    },
    request(options) {
      requestImpl(options)
    },
  }

  delete require.cache[require.resolve('./api')]
  delete require.cache[require.resolve('./emotionTagApi')]
  return require('./emotionTagApi')
}

test('getEmotionTags calls public emotion tag endpoint', async () => {
  let requestOptions
  const { getEmotionTags } = loadApi((options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            { key: 'warm', label: '温暖' },
          ],
        },
      },
    })
  })

  const data = await getEmotionTags()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/emotion-tags')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.header.Authorization, undefined)
  assert.deepEqual(data.items, [
    { key: 'warm', label: '温暖' },
  ])
})
