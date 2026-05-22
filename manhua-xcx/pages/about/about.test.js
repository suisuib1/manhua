const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('about page uses styled page and card containers', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'about.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'about.wxss'), 'utf8')

  assert.equal(wxml.includes('about-page'), true)
  assert.equal(wxml.includes('about-card'), true)
  assert.equal(wxml.includes('section-title'), true)
  assert.equal(wxml.includes('section-desc'), true)
  assert.equal(wxss.includes('.about-page'), true)
  assert.equal(wxss.includes('.about-card'), true)
})

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
  assert.equal(wxml.includes('about-card'), true)
})
