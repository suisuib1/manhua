const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function createMockStorage() {
  const storage = {}

  return {
    storage,
    wx: {
      navigateTo() {},
      showToast() {},
      getStorageSync(key) {
        return storage[key]
      },
      setStorageSync(key, value) {
        storage[key] = value
      },
      removeStorageSync(key) {
        delete storage[key]
      },
    },
  }
}

function loadPage(initialStorage = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []
  const storage = Object.assign({}, initialStorage)

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    navigateTo(options) {
      navigateCalls.push(options)
    },
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeStorageSync(key) {
      delete storage[key]
    },
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    showToast() {},
  }

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/auth')]
  delete require.cache[require.resolve('../../../../utils/comicChapterApi')]
  delete require.cache[require.resolve('../../../../utils/chapterCatalog')]
  delete require.cache[require.resolve('./comic-book')]
  const moduleExports = require('./comic-book')

  return { pageConfig, moduleExports, navigateCalls, requestCalls, storage }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

test('我的漫画书页面展示实体书封面而不是普通列表', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'comic-book.wxml'), 'utf8')

  assert.equal(wxml.includes('book-cover'), true)
  assert.equal(wxml.includes('book-spine'), true)
  assert.equal(wxml.includes('comic-card'), false)
})

test('点击漫画书封面进入章节选择页', () => {
  const { pageConfig, navigateCalls } = loadPage()

  pageConfig.openComic()

  assert.deepEqual(navigateCalls[0], {
    url: '/subpackage/packageA/pages/chapter-list/chapter-list',
  })
})

test('漫画书封面展示章节数和页数摘要', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'comic-book.wxml'), 'utf8')

  assert.equal(wxml.includes('mock.bookSummary.updatedChapterText'), true)
  assert.equal(wxml.includes('mock.bookSummary.chapterText'), true)
  assert.equal(wxml.includes('mock.bookSummary.pageText'), true)
})

test('漫画书统计会合并本地生成章节', () => {
  const { moduleExports } = (() => {
    let pageConfig
    global.Page = (config) => {
      pageConfig = config
    }
    const { wx } = createMockStorage()
    global.wx = wx
    delete require.cache[require.resolve('./comic-book')]
    const moduleExports = require('./comic-book')
    return { pageConfig, moduleExports }
  })()

  const stats = moduleExports.getComicBookStats([
    { pages: [{}, {}] },
    { pages: [{}, {}, {}] },
  ])

  assert.equal(stats.chapterCount, 2)
  assert.equal(stats.pageCount, 5)
  assert.equal(stats.updatedChapterText, '已更新到第 2 章')
})

test('漫画书统计兼容本地章节的图片字段', () => {
  const { moduleExports } = (() => {
    global.Page = () => {}
    const { wx } = createMockStorage()
    global.wx = wx
    delete require.cache[require.resolve('./comic-book')]
    const moduleExports = require('./comic-book')
    return { moduleExports }
  })()

  const stats = moduleExports.getComicBookStats([
    { images: ['a.jpg', 'b.jpg'] },
    { generatedImage: 'single.jpg' },
  ])

  assert.equal(stats.chapterCount, 2)
  assert.equal(stats.pageCount, 3)
})

test('logged in comic book loads real recent chapters with limit 50', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-comic-book',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-real-1',
              title: '真实生日章节',
              date: '2026-05-28',
              status: 'completed',
              pageCount: 1,
              coverImageUrl: '/uploads/generated/real-1.png',
            },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/comic-chapters/recent')
  assert.equal(requestCalls[0].method, 'GET')
  assert.deepEqual(requestCalls[0].data, { limit: 50 })
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-comic-book')
  assert.deepEqual(pageConfig.data.mock.chapters.map((chapter) => chapter.title), ['真实生日章节'])
  assert.equal(pageConfig.data.mock.chapters.some((chapter) => chapter.subtitle === '春日野餐记'), false)
})

test('logged out comic book does not request backend or show mock chapters', async () => {
  const { pageConfig, requestCalls } = loadPage()

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls.length, 0)
  assert.deepEqual(pageConfig.data.mock.chapters, [])
  assert.equal(pageConfig.data.mock.bookSummary.chapterCount, 0)
})

test('comic book request failure does not fallback to mock chapters', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-comic-book',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls.length, 1)
  assert.deepEqual(pageConfig.data.mock.chapters, [])
  assert.equal(pageConfig.data.mock.bookSummary.chapterCount, 0)
})
