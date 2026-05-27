const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function readWxml() {
  return fs.readFileSync(path.join(__dirname, 'character.wxml'), 'utf8')
}

function loadPage() {
  let pageConfig
  const chooseCalls = []
  const toastCalls = []
  const requestCalls = []
  const navigateBackCalls = []
  const storage = arguments.length > 0 && arguments[0] ? arguments[0] : {}
  const requestImpl = arguments.length > 1 ? arguments[1] : null

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
    chooseMedia(options) {
      chooseCalls.push(options)
      options.success({
        tempFiles: [
          { tempFilePath: 'wxfile://tmp/new-reference-a.png' },
          { tempFilePath: '/tmp/new-reference-b.png' },
        ],
      })
    },
    showToast(options) {
      toastCalls.push(options)
    },
    navigateBack(options) {
      navigateBackCalls.push(options)
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
            nickname: '后端小满',
            roleTitle: '默认漫画书主角',
            description: '后端描述',
            personalityText: '温柔、好奇',
            appearanceText: '短发、圆眼睛',
            referenceImageUrl: 'https://example.com/reference.png',
          },
        },
      })
    },
  }

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/auth')]
  try {
    delete require.cache[require.resolve('../../../../utils/characterProfileApi')]
  } catch (error) {
  }
  delete require.cache[require.resolve('./character')]
  const moduleExports = require('./character')

  return { pageConfig, chooseCalls, toastCalls, requestCalls, navigateBackCalls, storage, moduleExports }
}

test('角色档案页不再渲染顶部大标题区域', () => {
  const wxml = readWxml()

  assert.equal(wxml.includes('polish-header'), false)
  assert.equal(wxml.includes('我的漫画主角'), false)
  assert.equal(wxml.includes('让每一章里的你都保持熟悉又可爱'), false)
})

test('from diary saves successfully then navigates back', async () => {
  const { pageConfig, navigateBackCalls, storage } = loadPage({
    authToken: 'token-character',
  }, (options) => {
    if (options.method === 'GET') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            nickname: '',
            roleTitle: '',
            description: '',
            personalityText: '',
            appearanceText: '',
            referenceImageUrl: '',
          },
        },
      })
      return
    }

    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          nickname: options.data.nickname,
          roleTitle: options.data.roleTitle,
          description: options.data.description,
          personalityText: options.data.personalityText,
          appearanceText: options.data.appearanceText,
          referenceImageUrl: options.data.referenceImageUrl,
        },
      },
    })
  })

  await pageConfig.onLoad({ from: 'diary' })
  pageConfig.onNicknameInput({ detail: { value: 'diary-profile' } })
  await pageConfig.saveCharacter()

  assert.deepEqual(navigateBackCalls[0], {
    delta: 1,
  })
  assert.equal(storage.characterProfile.nickname, 'diary-profile')
})

test('from diary save failure does not navigate back', async () => {
  const { pageConfig, navigateBackCalls, toastCalls } = loadPage({
    authToken: 'token-character',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onLoad({ from: 'diary' })
  await pageConfig.saveCharacter()

  assert.equal(navigateBackCalls.length, 0)
  assert.equal(toastCalls.length, 1)
})

test('性格关键词和外观特征使用统一输入区域', () => {
  const wxml = readWxml()

  assert.equal(wxml.includes('personality-input'), true)
  assert.equal(wxml.includes('appearance-input'), true)
  assert.equal(wxml.includes('bindinput="onPersonalityInput"'), true)
  assert.equal(wxml.includes('bindinput="onAppearanceInput"'), true)
  assert.equal(wxml.includes('togglePersonalityTag'), false)
  assert.equal(wxml.includes('toggleAppearanceTag'), false)
  assert.equal(wxml.includes('is-selected'), false)
})

test('主角形象参考图只保留一个上传入口', () => {
  const wxml = readWxml()

  assert.equal(wxml.includes('主角形象参考图'), true)
  assert.equal(wxml.includes('reference-single'), true)
  assert.equal(wxml.includes('wx:for="{{referenceImages}}"'), false)
})

test('选择新图片会替换旧的主角形象参考图', () => {
  const { pageConfig, chooseCalls } = loadPage()

  pageConfig.data.referenceImage = '/tmp/old-reference.png'
  pageConfig.chooseReferenceImage()

  assert.equal(chooseCalls[0].count, 1)
  assert.equal(pageConfig.data.referenceImage, 'wxfile://tmp/new-reference-a.png')
})

test('未登录加载角色档案不调用后端', () => {
  const { pageConfig, requestCalls } = loadPage()

  pageConfig.onLoad()

  assert.equal(requestCalls.length, 0)
  assert.equal(pageConfig.data.nickname.length > 0, true)
})

test('已登录加载角色档案会调用 GET 并填充字段', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-character',
  })

  await pageConfig.onLoad()

  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.endsWith('/api/users/me/character-profile'), true)
  assert.equal(requestCalls[0].method, 'GET')
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-character')
  assert.equal(pageConfig.data.nickname, '后端小满')
  assert.equal(pageConfig.data.description, '后端描述')
  assert.equal(pageConfig.data.personalityText, '温柔、好奇')
  assert.equal(pageConfig.data.appearanceText, '短发、圆眼睛')
  assert.equal(pageConfig.data.referenceImage, 'https://example.com/reference.png')
})

test('未登录保存角色档案提示请先登录', async () => {
  const { pageConfig, requestCalls, toastCalls } = loadPage()

  await pageConfig.saveCharacter()

  assert.equal(requestCalls.length, 0)
  assert.equal(toastCalls[0].title, '请先登录')
})

test('已登录保存角色档案会调用 PUT', async () => {
  const { pageConfig, requestCalls, toastCalls } = loadPage({
    authToken: 'token-character',
  })

  pageConfig.onNicknameInput({ detail: { value: '前端小满' } })
  pageConfig.onDescriptionInput({ detail: { value: '前端描述' } })
  pageConfig.onPersonalityInput({ detail: { value: '勇敢、安静' } })
  pageConfig.onAppearanceInput({ detail: { value: '短发、暖色外套' } })
  await pageConfig.saveCharacter()

  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.endsWith('/api/users/me/character-profile'), true)
  assert.equal(requestCalls[0].method, 'PUT')
  assert.deepEqual(requestCalls[0].data, {
    nickname: '前端小满',
    roleTitle: '默认漫画书主角',
    description: '前端描述',
    personalityText: '勇敢、安静',
    appearanceText: '短发、暖色外套',
    referenceImageUrl: '',
  })
  assert.equal(toastCalls[0].title, '保存成功')
})

test('本地临时参考图不会作为 referenceImageUrl 保存', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-character',
    characterProfile: {
      referenceImageUrl: 'https://example.com/old-reference.png',
    },
  })

  pageConfig.setData({
    referenceImageUrl: 'https://example.com/old-reference.png',
  })
  pageConfig.chooseReferenceImage()
  await pageConfig.saveCharacter()

  assert.equal(requestCalls[0].url.includes('/api/uploads/images'), false)
  assert.equal(requestCalls[0].data.referenceImageUrl, 'https://example.com/old-reference.png')
  assert.equal(pageConfig.data.referenceImage, 'wxfile://tmp/new-reference-a.png')
})

test('保存失败保留当前输入并提示失败', async () => {
  const { pageConfig, toastCalls } = loadPage({
    authToken: 'token-character',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  pageConfig.onNicknameInput({ detail: { value: '保留输入' } })
  await pageConfig.saveCharacter()

  assert.equal(pageConfig.data.nickname, '保留输入')
  assert.equal(toastCalls[0].title, '保存失败')
})
