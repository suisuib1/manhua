const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage() {
  let pageConfig
  const backCalls = []
  const setDataCalls = []
  const storage = {}

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      setDataCalls.push(patch)
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    navigateBack(options) {
      backCalls.push(options)
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

  delete require.cache[require.resolve('./continuous-chapter')]
  const moduleExports = require('./continuous-chapter')

  return { pageConfig, backCalls, setDataCalls, moduleExports }
}

test('阅读器使用 swiper 翻页而不是章节列表', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'continuous-chapter.wxml'), 'utf8')

  assert.equal(wxml.includes('page-swiper'), true)
  assert.equal(wxml.includes('comic-page-card'), true)
  assert.equal(wxml.includes('flow-card'), false)
  assert.equal(wxml.includes('readChapter'), false)
  assert.equal(wxml.includes('reader-progress-card'), true)
  assert.equal(wxml.includes('back-button'), false)
})

test('阅读器支持返回漫画书封面', () => {
  const { pageConfig, backCalls } = loadPage()

  pageConfig.goBackToComicList()

  assert.deepEqual(backCalls[0], {
    delta: 1,
  })
})

test('章节数据会展开成自然翻页顺序', () => {
  const { moduleExports } = loadPage()

  const pages = moduleExports.buildFlatPages([
    {
      id: 'chapter-001',
      title: '第1章',
      subtitle: '第一章',
      date: '05-16',
      pages: [{ pageId: 'p1-1', images: [], caption: '1-1' }, { pageId: 'p1-2', images: [], caption: '1-2' }],
    },
    {
      id: 'chapter-002',
      title: '第2章',
      subtitle: '第二章',
      date: '05-17',
      pages: [{ pageId: 'p2', images: [], caption: '2' }],
    },
  ])

  assert.deepEqual(pages.map((page) => `${page.chapterNo}-${page.pageNo}`), ['1-1', '1-2', '2-1'])
})

test('本地生成章节会合并进阅读器页面', () => {
  const { moduleExports } = loadPage()

  const pages = moduleExports.buildFlatPages([
    {
      id: 'local-generated-001',
      title: '新章节',
      subtitle: '本地生成',
      date: '2026-05-19',
      pages: [{ pageId: 'g1', images: ['b'], caption: 'g1' }, { pageId: 'g2', images: ['c'], caption: 'g2' }],
    },
    {
      id: 'chapter-003',
      title: '第3章',
      subtitle: '默认章节',
      date: '05-18',
      pages: [{ pageId: 'p3-1', images: ['a'], caption: '3-1' }],
    },
  ])

  assert.equal(pages.some((page) => page.chapterId === 'local-generated-001'), true)
  assert.equal(pages.slice(0, 2).map((page) => page.pageId).join(','), 'g1,g2')
})

test('章节最后一页后仍能继续到下一章第一页', () => {
  const { moduleExports } = loadPage()

  const pages = moduleExports.buildFlatPages([
    {
      id: 'chapter-001',
      title: '第1章',
      subtitle: '第一章',
      date: '05-16',
      pages: [{ pageId: 'p1-1', images: ['b'], caption: '1-1' }, { pageId: 'p1-2', images: ['c'], caption: '1-2' }],
    },
    {
      id: 'chapter-002',
      title: '第2章',
      subtitle: '第二章',
      date: '05-17',
      pages: [{ pageId: 'p2', images: ['a'], caption: '2' }],
    },
  ])

  assert.equal(pages[1].chapterNo, 1)
  assert.equal(pages[2].chapterNo, 2)
  assert.equal(pages[2].pageNo, 1)
})

test('滑动翻页时同步当前进度', () => {
  const { pageConfig, setDataCalls } = loadPage()

  pageConfig.onLoad()
  pageConfig.handlePageChange({
    detail: {
      current: 2,
    },
  })

  assert.equal(setDataCalls[1].currentIndex, 2)
  assert.equal(setDataCalls[1].progressText, '第 2 章 · 第 1 页 / 共 6 页')
})
