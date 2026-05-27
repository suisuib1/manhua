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

function loadPage() {
  let pageConfig
  const navigateCalls = []
  const storage = {}

  global.Page = (config) => {
    pageConfig = config
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
    showToast() {},
  }

  delete require.cache[require.resolve('./comic-book')]
  require('./comic-book')

  return { pageConfig, navigateCalls }
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
