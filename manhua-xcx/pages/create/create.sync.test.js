const assert = require('node:assert/strict')
const test = require('node:test')

function loadPage(storage = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    navigateTo(options) {
      navigateCalls.push(options)
    },
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('../../utils/diaryApi')]
  delete require.cache[require.resolve('../../utils/diarySync')]
  delete require.cache[require.resolve('./create')]
  require('./create')

  return {
    pageConfig,
    navigateCalls,
    requestCalls,
    storage,
  }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

test('创建页未登录时继续只保存本地草稿并跳转日记页', () => {
  const { pageConfig, navigateCalls, requestCalls, storage } = loadPage()

  pageConfig.goNext()

  assert.equal(requestCalls.length, 0)
  assert.equal(storage.draftComicChapter.chapterTitle, pageConfig.data.draftChapterTitle)
  assert.equal(navigateCalls[0].url.startsWith('/pages/diary/diary?draft='), true)
})

test('创建页已登录时保存草稿会尝试创建后端草稿', async () => {
  const storage = {
    authToken: 'token-issue8',
  }
  const { pageConfig, requestCalls, storage: nextStorage } = loadPage(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-create-page',
        },
      },
    })
  })

  pageConfig.goNext()
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries')
  assert.equal(requestCalls[0].method, 'POST')
  assert.equal(nextStorage.draftComicChapter.serverDiaryEntryId, 'entry-create-page')
})

test('selected date is saved into local draft and diary page query', () => {
  const { pageConfig, navigateCalls, storage } = loadPage()

  pageConfig.onDateChange({
    detail: {
      value: '2026-05-21',
    },
  })
  pageConfig.goNext()

  const encodedDraft = navigateCalls[0].url.split('draft=')[1]
  const draftFromUrl = JSON.parse(decodeURIComponent(encodedDraft))

  assert.equal(pageConfig.data.diaryDateValue, '2026-05-21')
  assert.equal(pageConfig.data.diaryDateLabel, '2026-05-21')
  assert.equal(storage.draftComicChapter.diaryDate, '2026-05-21')
  assert.equal(draftFromUrl.diaryDate, '2026-05-21')
  assert.equal(navigateCalls[0].url.startsWith('/pages/diary/diary?draft='), true)
})
