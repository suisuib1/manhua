const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storage = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []
  const toastCalls = []
  const modalCalls = []

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
    showModal(options) {
      modalCalls.push(options)
    },
    showToast(options) {
      toastCalls.push(options)
    },
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('../../utils/diaryApi')]
  delete require.cache[require.resolve('../../utils/diarySync')]
  delete require.cache[require.resolve('./diary')]
  require('./diary')

  return {
    pageConfig,
    navigateCalls,
    requestCalls,
    toastCalls,
    modalCalls,
    storage,
  }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

test('diary page prompts for character profile before first generation', () => {
  const { pageConfig, navigateCalls, modalCalls, storage } = loadPage()

  pageConfig.setData({
    createDraft: {
      chapterTitle: '第一章',
    },
    diaryText: '今天想生成漫画',
  })

  pageConfig.goGenerating()

  assert.equal(modalCalls.length, 1)
  assert.equal(modalCalls[0].title, '完善主角设定')
  assert.equal(modalCalls[0].content, '设置主角昵称、性格和外观后，生成的漫画会更像你。')
  assert.equal(modalCalls[0].confirmText, '去设置')
  assert.equal(modalCalls[0].cancelText, '跳过，使用默认主角')
  assert.equal(navigateCalls.length, 0)
  assert.equal(storage.draftComicChapter, undefined)
})

test('diary page can skip character profile prompt and continue generation', async () => {
  const { pageConfig, navigateCalls, modalCalls, storage } = loadPage()

  pageConfig.setData({
    createDraft: {
      chapterTitle: '跳过主角设定',
    },
    diaryText: '直接生成第一章',
  })

  pageConfig.goGenerating()
  modalCalls[0].success({ cancel: true })
  await flushAsyncWork()

  assert.equal(storage.draftComicChapter.chapterTitle, '跳过主角设定')
  assert.equal(navigateCalls[0].url, '/pages/generating/generating')
})

test('diary page character prompt can navigate to character page', () => {
  const { pageConfig, navigateCalls, modalCalls } = loadPage()

  pageConfig.setData({
    createDraft: {
      chapterTitle: '去设置主角',
    },
    diaryText: '先补角色',
  })

  pageConfig.goGenerating()
  modalCalls[0].success({ confirm: true })

  assert.deepEqual(navigateCalls[0], {
    url: '/pages/character/character',
  })
})

test('diary page skips character prompt when local profile is valid', async () => {
  const storage = {
    characterProfile: {
      nickname: '小满',
      personalityText: '温柔',
      appearanceText: '短发',
    },
  }
  const { pageConfig, navigateCalls, modalCalls } = loadPage(storage)

  pageConfig.setData({
    createDraft: {
      chapterTitle: '已有主角',
    },
    diaryText: '继续生成',
  })

  pageConfig.goGenerating()
  await flushAsyncWork()

  assert.equal(modalCalls.length, 0)
  assert.equal(navigateCalls[0].url, '/pages/generating/generating')
})

test('日记页已登录且已有后端草稿 id 时保存完整草稿会 PUT 并继续进入生成中', async () => {
  const storage = {
    authToken: 'token-issue8',
    characterProfile: {
      nickname: '小满',
      personalityText: '温柔',
      appearanceText: '短发',
    },
    draftComicChapter: {
      serverDiaryEntryId: 'entry-from-create',
    },
  }
  const { pageConfig, navigateCalls, requestCalls, storage: nextStorage } = loadPage(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-from-create',
        },
      },
    })
  })

  pageConfig.setData({
    createDraft: {
      chapterTitle: '今天的小确幸',
      diaryDate: '2026-05-20',
      pageCount: 4,
      pageMode: 'continuous',
      selectedTags: ['开心'],
    },
    diaryText: '今天和朋友散步。',
    photoItem: {
      path: 'wxfile://tmp.jpg',
    },
  })

  pageConfig.goGenerating()
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries/entry-from-create')
  assert.equal(requestCalls[0].method, 'PUT')
  assert.equal(requestCalls[0].data.photos[0].imageUrl, 'wxfile://tmp.jpg')
  assert.equal(nextStorage.draftComicChapter.serverDiaryEntryId, 'entry-from-create')
  assert.equal(nextStorage.draftComicChapter.diaryText, '今天和朋友散步。')
  assert.deepEqual(navigateCalls[0], {
    url: '/pages/generating/generating',
  })
})

test('日记页后端同步失败时仍保留本地草稿并进入生成中', async () => {
  const storage = {
    authToken: 'token-issue8',
    characterProfile: {
      nickname: '小满',
      personalityText: '温柔',
      appearanceText: '短发',
    },
    generatedComicChapters: [{ id: 'chapter-1' }],
  }
  const { pageConfig, navigateCalls, toastCalls, storage: nextStorage } = loadPage(storage, (options) => {
    options.success({
      statusCode: 500,
      data: {
        code: 500,
        message: 'server error',
        data: null,
      },
    })
  })

  pageConfig.setData({
    createDraft: {
      chapterTitle: '失败兜底',
    },
    diaryText: '本地仍然保存',
  })

  pageConfig.goGenerating()
  await flushAsyncWork()

  assert.equal(nextStorage.draftComicChapter.chapterTitle, '失败兜底')
  assert.equal(nextStorage.draftComicChapter.diaryText, '本地仍然保存')
  assert.deepEqual(nextStorage.generatedComicChapters, [{ id: 'chapter-1' }])
  assert.equal(navigateCalls[0].url, '/pages/generating/generating')
  assert.equal(toastCalls[0].title, '已保存到本地，登录同步失败')
})
test('diary page does not render photo upload entry', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'diary.wxml'), 'utf8')

  assert.equal(wxml.includes('diary-textarea'), true)
  assert.equal(wxml.includes('goGenerating'), true)
  assert.equal(wxml.includes('photo-grid'), false)
  assert.equal(wxml.includes('photo-upload'), false)
  assert.equal(wxml.includes('photoItem'), false)
  assert.equal(wxml.includes('photoLimit'), false)
  assert.equal(wxml.includes('addPhotoPlaceholder'), false)
})
