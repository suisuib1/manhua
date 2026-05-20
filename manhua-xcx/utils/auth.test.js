const assert = require('node:assert/strict')
const test = require('node:test')

function loadAuth(storage = {}) {
  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeStorageSync(key) {
      delete storage[key]
    },
  }

  delete require.cache[require.resolve('./auth')]
  return require('./auth')
}

test('clearAuthSession only removes auth storage keys', () => {
  const storage = {
    authToken: 'token-1',
    currentUser: { id: 'user-1' },
    draftComicChapter: { id: 'draft-1' },
    generatedComicChapters: [{ id: 'chapter-1' }],
    comicAppSettings: { privateMode: true },
  }
  const { clearAuthSession } = loadAuth(storage)

  clearAuthSession()

  assert.equal(storage.authToken, undefined)
  assert.equal(storage.currentUser, undefined)
  assert.deepEqual(storage.draftComicChapter, { id: 'draft-1' })
  assert.deepEqual(storage.generatedComicChapters, [{ id: 'chapter-1' }])
  assert.deepEqual(storage.comicAppSettings, { privateMode: true })
})

test('saveAuthSession persists token and current user', () => {
  const storage = {}
  const { saveAuthSession } = loadAuth(storage)

  saveAuthSession('token-1', { id: 'user-1', nickname: '小满' })

  assert.equal(storage.authToken, 'token-1')
  assert.deepEqual(storage.currentUser, { id: 'user-1', nickname: '小满' })
})
