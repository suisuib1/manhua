const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('home page does not render the in-page custom title bar', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8')

  assert.equal(wxml.includes('home-navbar'), false)
  assert.equal(wxml.includes('home-nav-title'), false)
  assert.equal(wxml.includes('navBarHeight'), false)
  assert.equal(wxss.includes('.home-navbar'), false)
  assert.equal(wxss.includes('.home-nav-title'), false)
})

test('home page keeps the core entry content', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('user.greetingTitle'), true)
  assert.equal(wxml.includes('defaultComicBook.title'), true)
  assert.equal(wxml.includes('goCreateChapter'), true)
})

function loadPage(storageSeed = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []
  const storage = Object.assign({}, storageSeed)

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
    switchTab() {},
    getStorageSync(key) {
      return storage[key]
    },
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    getWindowInfo() {
      return { statusBarHeight: 20 }
    },
    getMenuButtonBoundingClientRect() {
      return null
    },
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  try {
    delete require.cache[require.resolve('../../utils/comicChapterApi')]
  } catch (error) {
  }
  delete require.cache[require.resolve('./index')]
  const moduleExports = require('./index')

  return { pageConfig, navigateCalls, requestCalls, storage, moduleExports }
}

test('首页最近章节进入漫画书阅读器而不是旧章节详情', () => {
  const { pageConfig, navigateCalls } = loadPage()

  pageConfig.goChapterDetail({
    currentTarget: {
      dataset: {
        id: 'chapter-002',
      },
    },
  })

  assert.deepEqual(navigateCalls[0], {
    url: '/pages/continuous-chapter/continuous-chapter?chapterId=chapter-002',
  })
})

test('首页最近章节卡片不再显示状态标签', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('chapter-status'), false)
  assert.equal(wxml.includes('status-dot'), false)
})

test('首页不展示更多章节占位提示卡片', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('memory-note'), false)
  assert.equal(wxml.includes('还没有更多章节时'), false)
  assert.equal(wxml.includes('home-empty-cat'), false)
})

test('unauthenticated home does not request recent comic chapters', async () => {
  const { pageConfig, requestCalls } = loadPage()

  await pageConfig.onLoad()

  assert.equal(requestCalls.length, 0)
  assert.equal(pageConfig.data.recentChapters[0].id, 'chapter-003')
})

test('authenticated home requests recent comic chapters', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  await pageConfig.onLoad()

  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.endsWith('/api/comic-chapters/recent'), true)
  assert.equal(requestCalls[0].method, 'GET')
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-recent')
})

test('home uses backend recent chapters when items are returned', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-1',
              title: '后端章节',
              date: '2026-05-22T00:00:00.000Z',
              summary: '后端摘要',
              status: 'completed',
              pageCount: 2,
              coverImageUrl: '/uploads/images/cover.png',
            },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()

  assert.equal(pageConfig.data.recentChapters.length, 1)
  assert.equal(pageConfig.data.recentChapters[0].id, 'entry-1')
  assert.equal(pageConfig.data.recentChapters[0].title, '后端章节')
  assert.equal(pageConfig.data.recentChapters[0].summary, '后端摘要')
  assert.equal(pageConfig.data.recentChapters[0].coverImageUrl, '/uploads/images/cover.png')
  assert.equal(pageConfig.data.recentChapters[0].pageCountText, '2 页')
})

test('home falls back to mock recent chapters when backend fails', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onLoad()

  assert.equal(pageConfig.data.recentChapters[0].id, 'chapter-003')
})
