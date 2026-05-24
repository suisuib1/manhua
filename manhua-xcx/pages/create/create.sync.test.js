const assert = require('node:assert/strict')
const test = require('node:test')

function loadPage(storage = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []
  const toastCalls = []

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
    showToast(options) {
      toastCalls.push(options)
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
    toastCalls,
    storage,
  }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

test('create page starts with empty title and no selected mood tags', () => {
  const { pageConfig } = loadPage()

  assert.equal(pageConfig.data.draftChapterTitle, '')
  assert.equal(pageConfig.data.draftChapterTitle.includes('和小猫一起的傍晚'), false)
  assert.deepEqual(pageConfig.data.selectedTags, [])
  assert.equal(pageConfig.data.tagOptions.some((item) => item.selected), false)
})

test('create page initial date uses runtime today instead of mock date', () => {
  const { pageConfig } = loadPage()
  const today = new Date()
  const expected = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')

  assert.equal(pageConfig.data.diaryDateValue, expected)
  assert.equal(pageConfig.data.diaryDateLabel, expected)
  assert.notEqual(pageConfig.data.diaryDateValue, '2026-05-18')
})

test('empty title does not save draft with mock title or navigate', () => {
  const { pageConfig, navigateCalls, requestCalls, toastCalls, storage } = loadPage()

  pageConfig.goNext()

  assert.equal(navigateCalls.length, 0)
  assert.equal(requestCalls.length, 0)
  assert.equal(storage.draftComicChapter, undefined)
  assert.equal(toastCalls.length, 1)
})

test('创建页未登录时继续只保存本地草稿并跳转日记页', () => {
  const { pageConfig, navigateCalls, requestCalls, storage } = loadPage()

  pageConfig.onTitleInput({
    detail: {
      value: '后端草稿标题',
    },
  })
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

  pageConfig.onTitleInput({
    detail: {
      value: '后端草稿标题',
    },
  })
  pageConfig.goNext()
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries')
  assert.equal(requestCalls[0].method, 'POST')
  assert.equal(nextStorage.draftComicChapter.serverDiaryEntryId, 'entry-create-page')
})

test('selected date is saved into local draft and diary page query', () => {
  const { pageConfig, navigateCalls, storage } = loadPage()

  pageConfig.onTitleInput({
    detail: {
      value: '指定日期标题',
    },
  })
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
