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
  delete require.cache[require.resolve('./characterProfileApi')]
  return require('./characterProfileApi')
}

test('getCharacterProfile calls character profile endpoint with auth', async () => {
  let requestOptions
  const { getCharacterProfile } = loadApi({ authToken: 'token-character' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          nickname: '小满',
        },
      },
    })
  })

  const profile = await getCharacterProfile()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/users/me/character-profile')
  assert.equal(requestOptions.method, 'GET')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-character')
  assert.equal(profile.nickname, '小满')
})

test('saveCharacterProfile calls character profile endpoint with auth', async () => {
  let requestOptions
  const { saveCharacterProfile } = loadApi({ authToken: 'token-character' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: options.data,
      },
    })
  })

  const profile = await saveCharacterProfile({
    nickname: '小满',
    roleTitle: '默认漫画书主角',
    description: '喜欢暖色外套',
    personalityText: '温柔、好奇',
    appearanceText: '短发',
    referenceImageUrl: 'https://example.com/reference.png',
  })

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/users/me/character-profile')
  assert.equal(requestOptions.method, 'PUT')
  assert.equal(requestOptions.header.Authorization, 'Bearer token-character')
  assert.equal(profile.nickname, '小满')
})

test('saveCharacterProfile only submits allowed fields', async () => {
  let requestOptions
  const { saveCharacterProfile } = loadApi({ authToken: 'token-character' }, (options) => {
    requestOptions = options
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: options.data,
      },
    })
  })

  await saveCharacterProfile({
    id: 'should-not-submit',
    ownerUserId: 'should-not-submit',
    nickname: '小满',
    roleTitle: '默认漫画书主角',
    description: '喜欢暖色外套',
    personalityText: '温柔、好奇',
    appearanceText: '短发',
    referenceImageUrl: 'https://example.com/reference.png',
    createdAt: 'should-not-submit',
  })

  assert.deepEqual(requestOptions.data, {
    nickname: '小满',
    roleTitle: '默认漫画书主角',
    description: '喜欢暖色外套',
    personalityText: '温柔、好奇',
    appearanceText: '短发',
    referenceImageUrl: 'https://example.com/reference.png',
  })
})
