const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('privacy page uses styled page and card containers', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'privacy.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'privacy.wxss'), 'utf8')

  assert.equal(wxml.includes('privacy-page'), true)
  assert.equal(wxml.includes('privacy-card'), true)
  assert.equal(wxml.includes('section-title'), true)
  assert.equal(wxml.includes('section-desc'), true)
  assert.equal(wxss.includes('.privacy-page'), true)
  assert.equal(wxss.includes('.privacy-card'), true)
})

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
  assert.equal(wxml.includes('privacy-card'), true)
})
