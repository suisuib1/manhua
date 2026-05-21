const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('隐私说明页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8')

  assert.equal(appJson.includes('pages/privacy/privacy'), true)
})

test('隐私说明页展示静态隐私边界', () => {
  const js = fs.readFileSync(path.join(__dirname, 'privacy.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(__dirname, 'privacy.wxml'), 'utf8')

  assert.equal(wxml.includes('隐私说明'), true)
  assert.equal(js.includes('日记原文默认私密'), true)
  assert.equal(js.includes('不做公开社区'), true)
  assert.equal(wxml.includes('info-card'), true)
})
