const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storage = {}) {
  let pageConfig
  const toastCalls = []
  const modalCalls = []

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
    removeStorageSync(key) {
      delete storage[key]
    },
    showToast(options) {
      toastCalls.push(options)
    },
    showModal(options) {
      modalCalls.push(options)
      if (options.success) {
        options.success({ confirm: true, cancel: false })
      }
    },
  }

  delete require.cache[require.resolve('./settings')]
  require('./settings')

  return { pageConfig, storage, toastCalls, modalCalls }
}

test('设置页 wxml 包含账号、偏好、隐私、提醒、关于和退出登录', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'settings.wxml'), 'utf8')

  assert.equal(wxml.includes('account-card'), true)
  assert.equal(wxml.includes('autoSaveDraft'), true)
  assert.equal(wxml.includes('keepPhotoMood'), true)
  assert.equal(wxml.includes('privateMode'), true)
  assert.equal(wxml.includes('diaryReminder'), true)
  assert.equal(wxml.includes('generationReminder'), true)
  assert.equal(wxml.includes('logout-button'), true)
})

test('设置页默认从本地缓存读取默认值', () => {
  const { pageConfig } = loadPage()

  pageConfig.onLoad()

  assert.deepEqual(pageConfig.data.settings, {
    autoSaveDraft: true,
    keepPhotoMood: true,
    privateMode: true,
    diaryReminder: false,
    generationReminder: true,
  })
})

test('切换设置会立即保存到 comicAppSettings', () => {
  const { pageConfig, storage } = loadPage()

  pageConfig.onLoad()
  pageConfig.handleToggleChange({
    currentTarget: { dataset: { key: 'autoSaveDraft' } },
    detail: { value: false },
  })

  assert.equal(storage.comicAppSettings.autoSaveDraft, false)
  assert.equal(storage.comicAppSettings.keepPhotoMood, true)
})

test('清理草稿和生成缓存只删除指定 storage key', () => {
  const storage = {
    draftComicChapter: { id: 'draft-1' },
    generatedComicChapters: [{ id: 'chapter-1' }],
    token: 'keep-me',
  }
  const { pageConfig } = loadPage(storage)

  pageConfig.clearDraftCache()
  assert.equal(storage.draftComicChapter, undefined)
  assert.deepEqual(storage.generatedComicChapters, [{ id: 'chapter-1' }])
  assert.equal(storage.token, 'keep-me')

  pageConfig.clearGeneratedCache()
  assert.equal(storage.generatedComicChapters, undefined)
  assert.equal(storage.token, 'keep-me')
})

test('帮助入口保留提示，退出登录只清理登录态', () => {
  const storage = {
    authToken: 'token-keep',
    currentUser: { id: 'user-keep' },
    draftComicChapter: { id: 'draft-1' },
    generatedComicChapters: [{ id: 'chapter-1' }],
    comicAppSettings: { privateMode: true },
  }
  const { pageConfig, toastCalls } = loadPage(storage)

  pageConfig.handleHelpTap({ currentTarget: { dataset: { action: 'faq' } } })
  pageConfig.handleHelpTap({ currentTarget: { dataset: { action: 'version' } } })
  pageConfig.handleLogoutTap()

  assert.deepEqual(toastCalls[0], {
    title: '功能后续接入',
    icon: 'none',
  })
  assert.deepEqual(toastCalls[1], {
    title: '当前版本 v1.0.0',
    icon: 'none',
  })
  assert.deepEqual(toastCalls[2], {
    title: '已退出登录',
    icon: 'none',
  })
  assert.equal(storage.authToken, undefined)
  assert.equal(storage.currentUser, undefined)
  assert.deepEqual(storage.draftComicChapter, { id: 'draft-1' })
  assert.deepEqual(storage.generatedComicChapters, [{ id: 'chapter-1' }])
  assert.deepEqual(storage.comicAppSettings, { privateMode: true })
})
