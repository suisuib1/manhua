const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('关于产品页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8')

  assert.equal(appJson.includes('pages/about/about'), true)
})

test('关于产品页展示静态产品说明', () => {
  const js = fs.readFileSync(path.join(__dirname, 'about.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(__dirname, 'about.wxml'), 'utf8')

  assert.equal(wxml.includes('关于产品'), true)
  assert.equal(js.includes('私人漫画书'), true)
  assert.equal(js.includes('Q 版'), true)
  assert.equal(wxml.includes('info-card'), true)
})
