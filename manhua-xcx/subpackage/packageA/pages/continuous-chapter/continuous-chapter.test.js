const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('onLoad uses generatedComicChapters real image before mock fallback', () => {
  const generatedImageUrl = 'http://127.0.0.1:3000/uploads/generated/ai-reader-page.png'
  const { pageConfig, setDataCalls } = loadPage({
    generatedComicChapters: [{
      id: 'local-real-image',
      title: 'AI generated chapter',
      date: '2026-05-21',
      images: [generatedImageUrl],
      coverImageUrl: generatedImageUrl,
      pages: [{
        pageId: 'local-real-image-page-1',
        pageIndex: 0,
        images: [generatedImageUrl],
        caption: 'real generated image',
      }],
    }],
  })

  pageConfig.onLoad({ chapterId: 'local-real-image' })

  assert.equal(setDataCalls[0].currentPage.image, generatedImageUrl)
  assert.equal(setDataCalls[0].hasComicImages, true)
})

test('onLoad displays cached recent chapter cover image instead of mascot fallback', () => {
  const generatedImageUrl = 'http://127.0.0.1:3000/uploads/generated/openai-1779851239962-m89cn9tu.png'
  const { pageConfig, setDataCalls } = loadPage({
    generatedComicChapters: [{
      id: 'cmpnhaac5000aqwkww3oozxlg',
      diaryEntryId: 'cmpnhaac5000aqwkww3oozxlg',
      generationTaskId: 'cmpnhbn7t000eqwkw3avjiwnl',
      title: '今天过生日',
      pageCount: 1,
      coverImageUrl: generatedImageUrl,
      imageUrl: generatedImageUrl,
      images: [generatedImageUrl],
      pages: [{
        pageId: 'cmpnhaac5000aqwkww3oozxlg-page-1',
        images: [generatedImageUrl],
        imageUrl: generatedImageUrl,
      }],
    }],
  })

  pageConfig.onLoad({ chapterId: 'cmpnhaac5000aqwkww3oozxlg' })

  assert.equal(setDataCalls[0].currentPage.image, generatedImageUrl)
  assert.notEqual(setDataCalls[0].currentPage.image, '/subpackage/icon-home-mascot-star.png')
  assert.equal(setDataCalls[0].hasComicImages, true)
})

test('onLoad heals placeholder chapter from completed generation task image', async () => {
  const { pageConfig, requestCalls, setDataCalls, storage } = loadPage({
    authToken: 'token-reader',
    generatedComicChapters: [{
      id: 'local-placeholder',
      title: 'AI generated chapter',
      date: '2026-05-21',
      generationTaskId: 'task-reader-heal',
      images: ['/subpackage/icon-home-mascot-star.png'],
      coverImageUrl: '/subpackage/icon-home-mascot-star.png',
      pages: [{
        pageId: 'local-placeholder-page-1',
        pageIndex: 0,
        images: ['/subpackage/icon-home-mascot-star.png'],
        caption: 'placeholder image',
      }],
    }],
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-reader-heal',
          status: 'completed',
          result: {
            pages: [{ imageUrl: '/uploads/generated/healed-reader.png' }],
          },
        },
      },
    })
  })

  pageConfig.onLoad({ chapterId: 'local-placeholder' })
  await flushAsyncWork()

  const healedUrl = 'http://127.0.0.1:3000/uploads/generated/healed-reader.png'
  const latestSetData = setDataCalls[setDataCalls.length - 1]

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/generation-tasks/task-reader-heal')
  assert.equal(latestSetData.currentPage.image, healedUrl)
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], healedUrl)
  assert.equal(storage.generatedComicChapters[0].images[0], healedUrl)
  assert.equal(storage.generatedComicChapters[0].imageUrl, healedUrl)
  assert.equal(storage.generatedComicChapters[0].coverImageUrl, healedUrl)
})

test('onLoad normalizes cached relative generated image url', async () => {
  const { pageConfig, requestCalls, setDataCalls, storage } = loadPage({
    generatedComicChapters: [{
      id: 'local-relative-image',
      title: 'AI generated chapter',
      date: '2026-05-21',
      imageUrl: '/uploads/generated/relative-reader.png',
      pages: [{
        pageId: 'local-relative-image-page-1',
        images: ['/uploads/generated/relative-reader.png'],
      }],
    }],
  })

  pageConfig.onLoad({ chapterId: 'local-relative-image' })
  await flushAsyncWork()

  const fullUrl = 'http://127.0.0.1:3000/uploads/generated/relative-reader.png'
  const latestSetData = setDataCalls[setDataCalls.length - 1]

  assert.equal(requestCalls.length, 0)
  assert.equal(latestSetData.currentPage.image, fullUrl)
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], fullUrl)
  assert.equal(storage.generatedComicChapters[0].images[0], fullUrl)
  assert.equal(storage.generatedComicChapters[0].imageUrl, fullUrl)
  assert.equal(storage.generatedComicChapters[0].coverImageUrl, fullUrl)
})

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

function loadPage(initialStorage, requestImpl = () => {}) {
  let pageConfig
  const backCalls = []
  const redirectCalls = []
  const toastCalls = []
  const setDataCalls = []
  const requestCalls = []
  const storage = Object.assign({}, initialStorage)

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
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    showToast(options) {
      toastCalls.push(options)
    },
  }

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/generationTaskApi')]
  delete require.cache[require.resolve('./continuous-chapter')]
  const moduleExports = require('./continuous-chapter')

  return { pageConfig, backCalls, redirectCalls, toastCalls, setDataCalls, requestCalls, storage, moduleExports }
}

test('阅读器使用漫画阅读模式且图片不变形', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'continuous-chapter.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'continuous-chapter.wxss'), 'utf8')

  assert.equal(wxml.includes('<swiper'), false)
  assert.equal(wxml.includes('bindtouchstart="handleTouchStart"'), true)
  assert.equal(wxml.includes('bindtouchend="handleTouchEnd"'), true)
  assert.equal(wxml.includes('currentPage.image'), true)
  assert.equal(wxml.includes('comic-image'), true)
  assert.equal(wxml.includes('mode="widthFix"'), true)
  assert.equal(wxml.includes('mode="aspectFill"'), false)
  assert.equal(wxml.includes('暂无漫画图片'), true)
  assert.equal(wxml.includes('/subpackage/icon-home-mascot-star.png'), true)
  assert.equal(wxml.includes('reader-topbar'), false)
  assert.equal(wxml.includes('reader-title'), false)
  assert.equal(wxml.includes('reader-back'), false)
  assert.equal(wxml.includes('comic-page-card'), false)
  assert.equal(wxml.includes('page-meta'), false)
  assert.equal(wxml.includes('reader-bottom'), false)
  assert.equal(wxml.includes('左滑上一页'), false)
  assert.equal(wxml.includes('右滑下一页'), false)
  assert.equal(wxml.includes('page-number'), true)
  assert.equal(wxml.includes('comic-grid'), false)
  assert.equal(wxml.includes('comic-panel'), false)
  assert.equal(wxml.includes('flow-card'), false)
  assert.equal(wxml.includes('readChapter'), false)
  assert.equal(wxml.includes('reader-progress-card'), false)
  assert.equal(wxss.includes('.comic-image'), true)
  assert.equal(wxss.includes('.reader-topbar'), false)
  assert.equal(wxss.includes('height: auto;'), true)
  assert.equal(wxss.includes('min-height: 760rpx'), false)
})

test('阅读器支持返回漫画书封面', () => {
  const { pageConfig, redirectCalls } = loadPage()

  pageConfig.backToCover()

  assert.deepEqual(redirectCalls[0], {
    url: '/subpackage/packageA/pages/comic-book/comic-book',
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
    coverImageUrl: 'cover-url.jpg',
    coverImage: 'cover.jpg',
    generatedImage: 'generated.jpg',
  }), ['single.jpg', 'cover-url.jpg', 'cover.jpg', 'generated.jpg'])
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

test('自定义滑动翻页时左滑进入下一页右滑返回上一页', () => {
  const { pageConfig, setDataCalls } = loadPage()

  pageConfig.onLoad()
  pageConfig.handleTouchStart({ changedTouches: [{ clientX: 100 }] })
  pageConfig.handleTouchEnd({ changedTouches: [{ clientX: 30 }] })
  pageConfig.handleTouchStart({ changedTouches: [{ clientX: 30 }] })
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
  pageConfig.handleTouchEnd({ changedTouches: [{ clientX: 170 }] })

  assert.equal(pageConfig.data.currentIndex, 0)
  assert.equal(toastCalls[0].title, '已经是第一页')
})

test('阅读器可根据 chapterId 筛选目标章节并从第一页开始', () => {
  const { moduleExports } = loadPage()
  const chapters = [
    { id: 'chapter-001', title: '第一章', date: '05-16', pages: [{ pageId: 'p1', images: ['a'] }] },
    { id: 'chapter-002', title: '第二章', date: '05-17', pages: [{ pageId: 'p2-1', images: ['b'] }, { pageId: 'p2-2', images: ['c'] }] },
  ]
  const pages = moduleExports.buildPagesForReader(chapters, 'chapter-002')
  const state = moduleExports.buildReaderState(0, pages)

  assert.deepEqual(pages.map((page) => page.pageId), ['p2-1', 'p2-2'])
  assert.equal(state.currentIndex, 0)
  assert.equal(state.currentPage.pageId, 'p2-1')
  assert.equal(state.progressText, '第 1 / 2 页')
})

test('阅读器没有 chapterId 时打开最新章节第一页', () => {
  const { moduleExports } = loadPage()
  const chapters = [
    { id: 'chapter-001', title: '旧章节', date: '2026-05-16', pages: [{ pageId: 'old-1', images: ['a'] }] },
    { id: 'chapter-002', title: '新章节', date: '2026-05-18', pages: [{ pageId: 'new-1', images: ['b'] }] },
  ]
  const pages = moduleExports.buildPagesForReader(chapters)

  assert.equal(pages[0].chapterId, 'chapter-002')
  assert.equal(moduleExports.buildReaderState(0, pages).progressText, '第 1 / 1 页')
})

test('阅读器页面按 sortOrder pageIndex index 升序排列', () => {
  const { moduleExports } = loadPage()
  const pages = moduleExports.buildPagesForReader([{
    id: 'chapter-001',
    title: '排序章节',
    date: '2026-05-18',
    pages: [
      { pageId: 'by-index', index: 3, images: ['c'] },
      { pageId: 'by-sort-order', sortOrder: 1, images: ['a'] },
      { pageId: 'by-page-index', pageIndex: 2, images: ['b'] },
    ],
  }], 'chapter-001')

  assert.deepEqual(pages.map((page) => page.pageId), ['by-sort-order', 'by-page-index', 'by-index'])
})

test('onLoad 使用 chapterId 时 currentPage 初始化为目标章节第一页', () => {
  const { pageConfig, setDataCalls } = loadPage({
    generatedComicChapters: [{
      id: 'local-001',
      title: '本地章节',
      date: '2026-05-20',
      pages: [{ pageId: 'local-2', sortOrder: 2, images: ['b'] }, { pageId: 'local-1', sortOrder: 1, images: ['a'] }],
    }],
  })

  pageConfig.onLoad({ chapterId: 'local-001' })

  assert.equal(setDataCalls[0].currentIndex, 0)
  assert.equal(setDataCalls[0].currentPage.pageId, 'local-1')
  assert.equal(setDataCalls[0].progressText, '第 1 / 2 页')
})
