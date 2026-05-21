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

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    chooseMedia(options) {
      chooseCalls.push(options)
      options.success({
        tempFiles: [
          { tempFilePath: '/tmp/new-reference-a.png' },
          { tempFilePath: '/tmp/new-reference-b.png' },
        ],
      })
    },
    showToast() {},
  }

  delete require.cache[require.resolve('./character')]
  require('./character')

  return { pageConfig, chooseCalls }
}

test('角色档案页不再渲染顶部大标题区域', () => {
  const wxml = readWxml()

  assert.equal(wxml.includes('polish-header'), false)
  assert.equal(wxml.includes('我的漫画主角'), false)
  assert.equal(wxml.includes('让每一章里的你都保持熟悉又可爱'), false)
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
  assert.equal(pageConfig.data.referenceImage, '/tmp/new-reference-a.png')
})
