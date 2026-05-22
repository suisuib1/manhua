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

function loadPage() {
  let pageConfig
  const navigateCalls = []

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
    getWindowInfo() {
      return { statusBarHeight: 20 }
    },
    getMenuButtonBoundingClientRect() {
      return null
    },
  }

  delete require.cache[require.resolve('./index')]
  require('./index')

  return { pageConfig, navigateCalls }
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
