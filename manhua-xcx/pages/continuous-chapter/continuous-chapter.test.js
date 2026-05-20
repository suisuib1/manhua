const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage() {
  let pageConfig
  const backCalls = []
  const redirectCalls = []
  const toastCalls = []
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
    redirectTo(options) {
      redirectCalls.push(options)
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
    showToast(options) {
      toastCalls.push(options)
    },
  }

  delete require.cache[require.resolve('./continuous-chapter')]
  const moduleExports = require('./continuous-chapter')

  return { pageConfig, backCalls, redirectCalls, toastCalls, setDataCalls, moduleExports }
}

test('阅读器使用 swiper 翻页而不是章节列表', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'continuous-chapter.wxml'), 'utf8')

  assert.equal(wxml.includes('<swiper'), false)
  assert.equal(wxml.includes('bindtouchstart="handleTouchStart"'), true)
  assert.equal(wxml.includes('bindtouchend="handleTouchEnd"'), true)
  assert.equal(wxml.includes('currentPage.image'), true)
  assert.equal(wxml.includes('comic-image'), true)
  assert.equal(wxml.includes('暂无漫画图片'), true)
  assert.equal(wxml.includes('comic-page-card'), true)
  assert.equal(wxml.includes('comic-grid'), false)
  assert.equal(wxml.includes('comic-panel'), false)
  assert.equal(wxml.includes('flow-card'), false)
  assert.equal(wxml.includes('readChapter'), false)
  assert.equal(wxml.includes('reader-progress-card'), true)
  assert.equal(wxml.includes('back-button'), false)
})

test('阅读器支持返回漫画书封面', () => {
  const { pageConfig, redirectCalls } = loadPage()

  pageConfig.backToCover()

  assert.deepEqual(redirectCalls[0], {
    url: '/pages/comic-book/comic-book',
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

test('chapter image extraction supports compatible fields', () => {
  const { moduleExports } = loadPage()

  assert.deepEqual(moduleExports.getChapterImages({
    images: ['a.jpg', { imageUrl: 'b.png' }, { path: 'c.webp' }],
    pages: [{ imageUrl: 'page-a.jpg' }],
  }), ['a.jpg', 'b.png', 'c.webp', 'page-a.jpg'])

  assert.deepEqual(moduleExports.getChapterImages({
    imageUrl: 'single.jpg',
    coverImage: 'cover.jpg',
    generatedImage: 'generated.jpg',
  }), ['single.jpg', 'cover.jpg', 'generated.jpg'])
})

test('flat pages display one comic image per reader page', () => {
  const { moduleExports } = loadPage()

  const pages = moduleExports.buildFlatPages([
    {
      id: 'chapter-001',
      title: '第 1 章',
      date: '05-16',
      images: ['cover.jpg'],
      pages: [
        { pageId: 'p1', images: ['page-1.jpg', 'panel-extra.jpg'], caption: '1' },
        { pageId: 'p2', imageUrl: 'page-2.jpg', caption: '2' },
      ],
    },
  ])

  assert.deepEqual(pages.map((page) => page.image), ['page-1.jpg', 'page-2.jpg'])
  assert.deepEqual(pages.map((page) => page.pageText), ['第 1 / 2 页', '第 2 / 2 页'])
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

test('自定义滑动翻页时同步当前进度', () => {
  const { pageConfig, setDataCalls } = loadPage()

  pageConfig.onLoad()
  pageConfig.handleTouchStart({ changedTouches: [{ clientX: 100 }] })
  pageConfig.handleTouchEnd({ changedTouches: [{ clientX: 170 }] })
  pageConfig.handleTouchStart({ changedTouches: [{ clientX: 170 }] })
  pageConfig.handleTouchEnd({ changedTouches: [{ clientX: 100 }] })

  assert.equal(setDataCalls[1].currentIndex, 1)
  assert.equal(setDataCalls[2].currentIndex, 0)
})

test('reader state supports single page count text', () => {
  const { moduleExports } = loadPage()

  const state = moduleExports.buildReaderState(0, [{
    pageId: 'p1',
    chapterNo: 1,
    chapterTitle: '单图',
    pageNo: 1,
    image: 'only.jpg',
  }])

  assert.equal(state.currentPage.image, 'only.jpg')
  assert.equal(state.progressText, '第 1 / 1 页')
})

test('custom touch paging keeps page index within bounds', () => {
  const { pageConfig, toastCalls } = loadPage()

  pageConfig.onLoad()
  pageConfig.handleTouchStart({ changedTouches: [{ clientX: 100 }] })
  pageConfig.handleTouchEnd({ changedTouches: [{ clientX: 30 }] })

  assert.equal(pageConfig.data.currentIndex, 0)
  assert.equal(toastCalls[0].title, '已经是第一页')
})

test('阅读器可根据 chapterId 定位到目标章节第一页', () => {
  const { moduleExports } = loadPage()
  const flatPages = [
    { chapterId: 'chapter-001', pageNo: 1 },
    { chapterId: 'chapter-001', pageNo: 2 },
    { chapterId: 'chapter-002', pageNo: 1 },
  ]

  assert.equal(moduleExports.findInitialPageIndex(flatPages, 'chapter-002'), 2)
})

test('阅读器 chapterId 不存在时回退第一页', () => {
  const { moduleExports } = loadPage()
  const flatPages = [
    { chapterId: 'chapter-001', pageNo: 1 },
    { chapterId: 'chapter-001', pageNo: 2 },
  ]

  assert.equal(moduleExports.findInitialPageIndex(flatPages, 'missing'), 0)
})
