const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('点击用户信息区域会通过后端登录并保存 token', async () => {
  let pageConfig
  const storage = {}
  let requestOptions

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
    login(options) {
      options.success({ code: 'test_issue5_code' })
    },
    request(options) {
      requestOptions = options
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            token: 'token-issue5',
            user: {
              id: 'user-issue5',
              nickname: '小满',
              avatarUrl: '',
            },
            isNewUser: true,
          },
        },
      })
    },
    showToast() {
    },
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('./mine')]
  require('./mine')

  assert.equal(typeof pageConfig.handleUserInfoTap, 'function')

  await pageConfig.handleUserInfoTap()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/auth/wechat/login')
  assert.equal(storage.authToken, 'token-issue5')
  assert.equal(storage.currentUser.id, 'user-issue5')
  assert.equal(pageConfig.data.mock.user.nickname, '小满')
})

test('个人中心不展示今日免费次数卡片', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'mine.wxml'), 'utf8')

  assert.equal(wxml.includes('quota-card'), false)
  assert.equal(wxml.includes('goQuotaEmpty'), false)
})

test('用户信息卡片绑定登录入口且不依赖外部菜单图标资源', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'mine.wxml'), 'utf8')

  assert.equal(wxml.includes('bindtap="handleUserInfoTap"'), true)
  assert.equal(wxml.includes('bindtap="openComicBook"'), false)
  assert.equal(wxml.includes('src="{{item.icon}}"'), false)
  assert.equal(wxml.includes('menu-icon icon-{{index}}'), true)
})

test('未登录时用户信息区显示未登录', () => {
  let pageConfig

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    getStorageSync() {
      return null
    },
  }

  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('./mine')]
  require('./mine')

  pageConfig.onShow()

  assert.equal(pageConfig.data.mock.user.nickname, '未登录')
})

test('已登录时优先展示本地 currentUser 昵称和头像', () => {
  let pageConfig
  const storage = {
    authToken: 'token-local',
    currentUser: {
      id: 'user-local',
      nickname: '本地小满',
      avatarUrl: '/avatar-local.png',
    },
  }

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
  }

  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('./mine')]
  require('./mine')

  pageConfig.onShow()

  assert.equal(pageConfig.data.mock.user.nickname, '本地小满')
  assert.equal(pageConfig.data.mock.user.avatar, '/avatar-local.png')
})

test('点击漫画书进入独立漫画书页面', () => {
  let pageConfig
  let navigateOptions

  global.Page = (config) => {
    pageConfig = config
  }

  global.wx = {
    getStorageSync(key) {
      return key === 'authToken' ? 'token-issue5' : null
    },
    navigateTo(options) {
      navigateOptions = options
    },
  }

  delete require.cache[require.resolve('./mine')]
  require('./mine')

  pageConfig.openComicBook()

  assert.deepEqual(navigateOptions, {
    url: '/pages/comic-book/comic-book',
  })
})

test('未登录点击顶部用户卡片会触发登录', async () => {
  let pageConfig
  const storage = {}
  let requestOptions
  let navigateOptions

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
    login(options) {
      options.success({ code: 'test_issue_login_from_card' })
    },
    request(options) {
      requestOptions = options
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            token: 'token-from-card',
            user: {
              id: 'user-from-card',
              nickname: '小满',
              avatarUrl: '',
            },
            isNewUser: true,
          },
        },
      })
    },
    navigateTo(options) {
      navigateOptions = options
    },
    showToast() {},
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('./mine')]
  require('./mine')

  await pageConfig.openComicBook()

  assert.equal(requestOptions.url, 'http://127.0.0.1:3000/api/auth/wechat/login')
  assert.equal(storage.authToken, 'token-from-card')
  assert.equal(storage.currentUser.id, 'user-from-card')
  assert.equal(pageConfig.data.mock.user.nickname, '小满')
  assert.equal(navigateOptions, undefined)
})

test('个人中心不内嵌章节选择列表', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'mine.wxml'), 'utf8')

  assert.equal(wxml.includes('chapter-picker'), false)
  assert.equal(wxml.includes('goChapterDetail'), false)
})

test('个人中心不展示顶部和菜单副说明文案', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'mine.wxml'), 'utf8')

  assert.equal(wxml.includes('book-open-hint'), false)
  assert.equal(wxml.includes('点开漫画书选择章节阅读'), false)
  assert.equal(wxml.includes('menu-desc'), false)
  assert.equal(wxml.includes('{{item.desc}}'), false)
})

test('点击说明和设置菜单进入对应页面', () => {
  let pageConfig
  const navigateCalls = []

  global.Page = (config) => {
    pageConfig = config
  }

  global.wx = {
    navigateTo(options) {
      navigateCalls.push(options)
    },
    showToast() {},
  }

  delete require.cache[require.resolve('./mine')]
  require('./mine')

  pageConfig.handleMenuTap({ currentTarget: { dataset: { action: 'privacy', title: '隐私说明' } } })
  pageConfig.handleMenuTap({ currentTarget: { dataset: { action: 'about', title: '关于产品' } } })
  pageConfig.handleMenuTap({ currentTarget: { dataset: { action: 'settings', title: '设置' } } })

  assert.deepEqual(navigateCalls, [
    { url: '/pages/privacy/privacy' },
    { url: '/pages/about/about' },
    { url: '/pages/settings/settings' },
  ])
})
