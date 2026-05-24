const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const componentDir = __dirname

test('login modal component exposes reusable visibility and actions', () => {
  const js = fs.readFileSync(path.join(componentDir, 'login-modal.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(componentDir, 'login-modal.wxml'), 'utf8')

  assert.equal(js.includes('visible'), true)
  assert.equal(wxml.includes('wx:if="{{visible}}"'), true)
  assert.equal(wxml.includes('bindtap="handleConfirm"'), true)
  assert.equal(wxml.includes('bindtap="handleClose"'), true)
})

test('login modal copy guides users to login', () => {
  const wxml = fs.readFileSync(path.join(componentDir, 'login-modal.wxml'), 'utf8')

  assert.equal(wxml.includes('登录后继续使用'), true)
  assert.equal(wxml.includes('登录后可以生成漫画日记、保存角色档案和查看个人漫画书。'), true)
  assert.equal(wxml.includes('立即登录'), true)
  assert.equal(wxml.includes('稍后再说'), true)
})

test('home page registers login modal component', () => {
  const indexJson = JSON.parse(fs.readFileSync(path.join(componentDir, '../../pages/index/index.json'), 'utf8'))

  assert.equal(indexJson.usingComponents['login-modal'], '../../components/login-modal/login-modal')
})
