const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('about page uses styled page and card containers', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'about.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'about.wxss'), 'utf8')

  assert.equal(wxml.includes('about-page'), true)
  assert.equal(wxml.includes('about-hero'), true)
  assert.equal(wxml.includes('about-card'), true)
  assert.equal(wxml.includes('feature-list'), true)
  assert.equal(wxml.includes('feature-item'), true)
  assert.equal(wxss.includes('.about-page'), true)
  assert.equal(wxss.includes('.about-hero'), true)
  assert.equal(wxss.includes('.about-card'), true)
})

test('about page presents product positioning without community promises', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'about.wxml'), 'utf8')

  assert.equal(wxml.includes('私人漫画日记本'), true)
  assert.equal(wxml.includes('Q 版漫画章节') || wxml.includes('Q 版'), true)
  assert.equal(wxml.includes('不做公开社区'), true)
  assert.equal(wxml.includes('评论'), true)
  assert.equal(wxml.includes('点赞'), true)
  assert.equal(wxml.includes('关注'), true)
  assert.equal(wxml.includes('公开社区能力'), false)
})

test('关于产品页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../../../app.json'), 'utf8')

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
