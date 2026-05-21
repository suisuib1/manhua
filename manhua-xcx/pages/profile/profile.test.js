const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storage = {}) {
  let pageConfig
  const toastCalls = []
  const chooseMediaCalls = []
  const chooseImageCalls = []

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
    showToast(options) {
      toastCalls.push(options)
    },
    chooseMedia(options) {
      chooseMediaCalls.push(options)
      if (options.success) {
        options.success({
          tempFiles: [{ tempFilePath: '/tmp/avatar-media.png' }],
        })
      }
    },
    chooseImage(options) {
      chooseImageCalls.push(options)
      if (options.success) {
        options.success({
          tempFilePaths: ['/tmp/avatar-image.png'],
        })
      }
    },
  }

  delete require.cache[require.resolve('./profile')]
  const moduleExports = require('./profile')

  return { pageConfig, moduleExports, toastCalls, chooseMediaCalls, chooseImageCalls }
}

test('个人资料页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8')

  assert.equal(appJson.includes('pages/profile/profile'), true)
})

test('个人资料页展示资料卡片和三项资料', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'profile.wxml'), 'utf8')

  assert.equal(wxml.includes('profile-page'), true)
  assert.equal(wxml.includes('{{profile.nickname}}'), true)
  assert.equal(wxml.includes('编辑资料'), true)
  assert.equal(wxml.includes('<view class="camera-button"'), true)
  assert.equal(wxml.includes('<button class="camera-button"'), false)
  assert.equal(wxml.includes('用户名'), true)
  assert.equal(wxml.includes('生日'), true)
  assert.equal(wxml.includes('所在地区'), true)
})

test('个人资料页默认使用本地占位资料', () => {
  const { pageConfig } = loadPage()

  pageConfig.onShow()

  assert.equal(pageConfig.data.profile.nickname, '漫画日记用户')
  assert.equal(pageConfig.data.profile.username, 'manhua_user')
  assert.equal(pageConfig.data.profile.birthday, '2000-05-20')
  assert.equal(pageConfig.data.profile.region, '广东省 深圳市')
})

test('个人资料页优先展示当前登录用户昵称和头像', () => {
  const { pageConfig } = loadPage({
    currentUser: {
      id: 'user-1',
      nickname: '小满',
      avatarUrl: '/avatar.png',
    },
  })

  pageConfig.onShow()

  assert.equal(pageConfig.data.profile.nickname, '小满')
  assert.equal(pageConfig.data.profile.avatar, '/avatar.png')
})

test('编辑按钮先保留占位提示', () => {
  const { pageConfig, toastCalls } = loadPage()

  pageConfig.handleEditTap()

  assert.equal(toastCalls[0].title, '编辑资料后续接入')
})

test('点击头像相机会选取照片并更新头像预览', () => {
  const { pageConfig, chooseMediaCalls, chooseImageCalls } = loadPage()

  pageConfig.handleAvatarTap()

  assert.equal(chooseMediaCalls.length, 1)
  assert.deepEqual(chooseMediaCalls[0].mediaType, ['image'])
  assert.equal(chooseMediaCalls[0].count, 1)
  assert.equal(chooseImageCalls.length, 0)
  assert.equal(pageConfig.data.profile.avatar, '/tmp/avatar-media.png')
})

test('不支持 chooseMedia 时兜底使用 chooseImage', () => {
  const { pageConfig, chooseImageCalls } = loadPage()

  delete wx.chooseMedia
  pageConfig.handleAvatarTap()

  assert.equal(chooseImageCalls.length, 1)
  assert.equal(chooseImageCalls[0].count, 1)
  assert.equal(pageConfig.data.profile.avatar, '/tmp/avatar-image.png')
})
