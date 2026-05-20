const assert = require('node:assert/strict')
const test = require('node:test')

function loadPage(storage = {}, requestHandler) {
  let pageConfig
  const toastCalls = []
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
    removeStorageSync(key) {
      delete storage[key]
    },
    request(options) {
      requestCalls.push(options)
      requestHandler(options)
    },
    showToast(options) {
      toastCalls.push(options)
    },
    showModal() {},
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('./settings')]
  require('./settings')

  return { pageConfig, storage, toastCalls, requestCalls }
}

test('登录后优先读取后端设置并同步本地缓存', async () => {
  const storage = {
    authToken: 'token-issue5',
    comicAppSettings: {
      autoSaveDraft: false,
      keepPhotoMood: false,
    },
  }
  const { pageConfig } = loadPage(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          autoSaveDraft: true,
          keepPhotoMood: true,
          privateMode: true,
          diaryReminder: false,
          generationReminder: true,
        },
      },
    })
  })

  await pageConfig.loadSettings()

  assert.equal(pageConfig.data.settings.autoSaveDraft, true)
  assert.equal(storage.comicAppSettings.keepPhotoMood, true)
})

test('设置保存失败会恢复原值并提示保存失败', async () => {
  const storage = {
    authToken: 'token-issue5',
    comicAppSettings: {
      autoSaveDraft: true,
      keepPhotoMood: true,
      privateMode: true,
      diaryReminder: false,
      generationReminder: true,
    },
  }
  const { pageConfig, toastCalls } = loadPage(storage, (options) => {
    options.success({
      statusCode: 500,
      data: {
        code: 500,
        message: '服务端错误',
        data: null,
      },
    })
  })

  pageConfig.data.settings = Object.assign({}, storage.comicAppSettings)

  await pageConfig.handleToggleChange({
    currentTarget: { dataset: { key: 'autoSaveDraft' } },
    detail: { value: false },
  })

  assert.equal(pageConfig.data.settings.autoSaveDraft, true)
  assert.equal(storage.comicAppSettings.autoSaveDraft, true)
  assert.equal(toastCalls.at(-1).title, '保存失败')
})

test('设置保存只提交允许的字段', async () => {
  const storage = {
    authToken: 'token-issue5',
  }
  let savedPayload
  const { pageConfig } = loadPage(storage, (options) => {
    savedPayload = options.data
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: Object.assign({
          autoSaveDraft: true,
          keepPhotoMood: true,
          privateMode: true,
          diaryReminder: false,
          generationReminder: true,
        }, options.data),
      },
    })
  })

  pageConfig.data.settings = {
    autoSaveDraft: true,
    keepPhotoMood: true,
    privateMode: true,
    diaryReminder: false,
    generationReminder: true,
  }

  await pageConfig.saveSettingsPatch({
    autoSaveDraft: false,
    userId: 'should-not-send',
  })

  assert.deepEqual(savedPayload, {
    autoSaveDraft: false,
  })
})
