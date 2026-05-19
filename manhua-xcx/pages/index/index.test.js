const assert = require('node:assert/strict')
const test = require('node:test')

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
