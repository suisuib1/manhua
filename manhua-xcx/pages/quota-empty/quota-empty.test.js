const assert = require('node:assert/strict')
const test = require('node:test')

function loadPage() {
  let pageConfig
  const navigateCalls = []

  global.Page = (config) => {
    pageConfig = config
  }

  global.wx = {
    navigateTo(options) {
      navigateCalls.push(options)
    },
    switchTab() {},
  }

  delete require.cache[require.resolve('./quota-empty')]
  require('./quota-empty')

  return { pageConfig, navigateCalls }
}

test('免费次数用尽页查看已有漫画进入漫画书封面', () => {
  const { pageConfig, navigateCalls } = loadPage()

  pageConfig.viewChapter()

  assert.deepEqual(navigateCalls[0], {
    url: '/pages/comic-book/comic-book',
  })
})
