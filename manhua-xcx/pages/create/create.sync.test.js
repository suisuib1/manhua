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

function inputPageCount(pageConfig, value = '2') {
  pageConfig.onPageCountInput({
    detail: {
      value,
    },
  })
}

test('create page requests emotion tags on load', async () => {
  const { pageConfig, requestCalls } = loadPage({}, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            { key: 'backend-warm', label: '后端温暖' },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/emotion-tags')
  assert.equal(requestCalls[0].method, 'GET')
})

test('create page uses backend emotion tags without selecting them', async () => {
  const { pageConfig } = loadPage({}, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            { key: 'backend-warm', label: '后端温暖' },
            { key: 'backend-calm', label: '后端平静' },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()

  assert.deepEqual(pageConfig.data.tagOptions, [
    { value: 'backend-warm', label: '后端温暖', selected: false },
    { value: 'backend-calm', label: '后端平静', selected: false },
  ])
  assert.deepEqual(pageConfig.data.selectedTags, [])
})

test('create draft keeps selected tag keys and labels from backend tags', async () => {
  const { pageConfig, navigateCalls, storage } = loadPage({}, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            { key: 'backend-warm', label: '后端温暖' },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()
  pageConfig.toggleTag({
    currentTarget: {
      dataset: {
        value: 'backend-warm',
      },
    },
  })
  pageConfig.onTitleInput({
    detail: {
      value: '后端标签草稿',
    },
  })
  inputPageCount(pageConfig)
  pageConfig.goNext()

  const encodedDraft = navigateCalls[0].url.split('draft=')[1]
  const draftFromUrl = JSON.parse(decodeURIComponent(encodedDraft))

  assert.deepEqual(storage.draftComicChapter.selectedTags, ['backend-warm'])
  assert.deepEqual(storage.draftComicChapter.selectedTagItems, [
    { key: 'backend-warm', label: '后端温暖' },
  ])
  assert.deepEqual(draftFromUrl.selectedTagItems, [
    { key: 'backend-warm', label: '后端温暖' },
  ])
})

test('create page falls back to local emotion tags when request fails', async () => {
  const { pageConfig } = loadPage({}, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onLoad()

  assert.equal(pageConfig.data.tagOptions.length > 0, true)
  assert.equal(pageConfig.data.tagOptions[0].value, 'warm')
  assert.equal(pageConfig.data.tagOptions.some((item) => item.selected), false)
})

test('create page starts with empty title and no selected mood tags', () => {
  const { pageConfig } = loadPage()

  assert.equal(pageConfig.data.draftChapterTitle, '')
  assert.equal(pageConfig.data.pageCount, '')
  assert.equal(pageConfig.data.pageCountInput, '')
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
  inputPageCount(pageConfig)
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
  inputPageCount(pageConfig)
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
  inputPageCount(pageConfig)
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

test('page count input saves manual values from 1 to 4', () => {
  ;[1, 2, 3, 4].forEach((pageCount) => {
    const { pageConfig, storage } = loadPage()

    pageConfig.onTitleInput({
      detail: {
        value: `页数 ${pageCount}`,
      },
    })
    pageConfig.onPageCountInput({
      detail: {
        value: String(pageCount),
      },
    })
    pageConfig.goNext()

    assert.equal(storage.draftComicChapter.pageCount, pageCount)
  })
})

test('page count input can be cleared while editing', () => {
  const { pageConfig } = loadPage()

  pageConfig.onPageCountInput({
    detail: {
      value: '2',
    },
  })
  assert.equal(pageConfig.data.pageCountInput, '2')

  pageConfig.onPageCountInput({
    detail: {
      value: '',
    },
  })

  assert.equal(pageConfig.data.pageCountInput, '')
  assert.equal(pageConfig.data.pageCount, '')
})

test('invalid page count input is clamped or blocked before saving draft', () => {
  const cases = [
    { value: '0', expected: 1 },
    { value: '5', expected: 4 },
  ]

  cases.forEach((item) => {
    const { pageConfig, storage } = loadPage()

    pageConfig.onTitleInput({
      detail: {
        value: `异常页数 ${item.value || 'empty'}`,
      },
    })
    pageConfig.onPageCountInput({
      detail: {
        value: item.value,
      },
    })
    pageConfig.goNext()

    assert.equal(storage.draftComicChapter.pageCount, item.expected)
    assert.equal(pageConfig.data.pageCount, item.expected)
    assert.equal(pageConfig.data.pageCountInput, String(item.expected))
    assert.notEqual(storage.draftComicChapter.pageCount, '')
    assert.equal(Number.isNaN(storage.draftComicChapter.pageCount), false)
  })
})

test('empty or non-numeric page count blocks draft save', () => {
  ;['', 'abc'].forEach((value) => {
    const { pageConfig, navigateCalls, storage, toastCalls } = loadPage()

    pageConfig.onTitleInput({
      detail: {
        value: `空页数 ${value || 'empty'}`,
      },
    })
    pageConfig.onPageCountInput({
      detail: {
        value,
      },
    })
    pageConfig.goNext()

    assert.equal(storage.draftComicChapter, undefined)
    assert.equal(navigateCalls.length, 0)
    assert.equal(toastCalls[0].title, '请填写漫画页数')
  })
})

test('random page mode only generates 1 to 4 pages', () => {
  const originalRandom = Math.random

  try {
    ;[
      { randomValue: 0, expected: 1 },
      { randomValue: 0.25, expected: 2 },
      { randomValue: 0.5, expected: 3 },
      { randomValue: 0.999, expected: 4 },
    ].forEach(({ randomValue, expected }) => {
      Math.random = () => randomValue
      const { pageConfig, storage } = loadPage()

      pageConfig.selectRandomPageMode()
      pageConfig.onTitleInput({
        detail: {
          value: `随机页数 ${randomValue}`,
        },
      })
      pageConfig.goNext()

      assert.equal(storage.draftComicChapter.pageCount, expected)
      assert.equal(pageConfig.data.pageCountInput, String(storage.draftComicChapter.pageCount))
    })
  } finally {
    Math.random = originalRandom
  }
})
