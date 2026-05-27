const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storage = {}, requestImpl = null) {
  let pageConfig
  const toastCalls = []
  const chooseMediaCalls = []
  const chooseImageCalls = []
  const requestCalls = []

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
    showToast(options) {
      toastCalls.push(options)
    },
    request(options) {
      requestCalls.push(options)
      if (requestImpl) {
        requestImpl(options)
        return
      }

      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            nickname: '保存后的昵称',
            avatarUrl: '/avatar.png',
            bio: '保存后的简介',
          },
        },
      })
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

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/auth')]
  try {
    delete require.cache[require.resolve('../../../../utils/userApi')]
  } catch (error) {
  }
  delete require.cache[require.resolve('./profile')]
  const moduleExports = require('./profile')

  return { pageConfig, moduleExports, storage, toastCalls, chooseMediaCalls, chooseImageCalls, requestCalls }
}

test('个人资料页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../../../app.json'), 'utf8')

  assert.equal(appJson.includes('pages/profile/profile'), true)
})

test('个人资料页展示资料卡片和三项资料', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'profile.wxml'), 'utf8')

  assert.equal(wxml.includes('profile-page'), true)
  assert.equal(wxml.includes('{{profile.nickname}}'), true)
  assert.equal(wxml.includes('保存资料'), true)
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

test('未登录保存资料不会调用后端', async () => {
  const { pageConfig, requestCalls, toastCalls } = loadPage()

  pageConfig.onShow()
  await pageConfig.handleSaveProfile()

  assert.equal(requestCalls.length, 0)
  assert.equal(toastCalls[0].title, '请先登录')
})

test('登录后保存资料会调用 profile 接口并使用 auth', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-1',
    currentUser: {
      id: 'user-1',
      nickname: '旧昵称',
      avatarUrl: '/avatar.png',
      bio: '旧简介',
    },
  })

  pageConfig.onShow()
  pageConfig.onNicknameInput({ detail: { value: '新昵称' } })
  pageConfig.onBioInput({ detail: { value: '新简介' } })
  await pageConfig.handleSaveProfile()

  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.endsWith('/api/users/me/profile'), true)
  assert.equal(requestCalls[0].method, 'PUT')
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-1')
  assert.equal(requestCalls[0].data.nickname, '新昵称')
  assert.equal(requestCalls[0].data.bio, '新简介')
  assert.equal(requestCalls[0].data.avatarUrl, '/avatar.png')
})

test('保存成功后更新本地 currentUser 和页面资料', async () => {
  const storage = {
    authToken: 'token-1',
    currentUser: {
      id: 'user-1',
      nickname: '旧昵称',
      avatarUrl: '/avatar.png',
      bio: '旧简介',
    },
  }
  const { pageConfig, toastCalls } = loadPage(storage)

  pageConfig.onShow()
  await pageConfig.handleSaveProfile()

  assert.equal(storage.currentUser.nickname, '保存后的昵称')
  assert.equal(storage.currentUser.bio, '保存后的简介')
  assert.equal(pageConfig.data.profile.nickname, '保存后的昵称')
  assert.equal(pageConfig.data.profile.bio, '保存后的简介')
  assert.equal(toastCalls[0].title, '已保存')
})

test('保存失败时保留本地展示并给出提示', async () => {
  const { pageConfig, toastCalls } = loadPage({
    authToken: 'token-1',
    currentUser: {
      id: 'user-1',
      nickname: '小满',
      avatarUrl: '/avatar.png',
      bio: '原简介',
    },
  }, (options) => {
    options.fail(new Error('network error'))
  })

  pageConfig.onShow()
  await pageConfig.handleSaveProfile()

  assert.equal(pageConfig.data.profile.nickname, '小满')
  assert.equal(pageConfig.data.profile.bio, '原简介')
  assert.equal(toastCalls[0].title, '保存失败')
})

test('本地头像预览不触发上传接口也不保存临时路径', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-1',
    currentUser: {
      id: 'user-1',
      nickname: '小满',
      avatarUrl: 'https://example.com/avatar.png',
    },
  })

  pageConfig.onShow()
  pageConfig.handleAvatarTap()
  await pageConfig.handleSaveProfile()

  assert.equal(pageConfig.data.profile.avatar, '/tmp/avatar-media.png')
  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.includes('/api/uploads/images'), false)
  assert.equal(requestCalls[0].data.avatarUrl, 'https://example.com/avatar.png')
})
