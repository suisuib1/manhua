const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(initialStorage) {
  let pageConfig
  const navigateCalls = []
  const switchTabCalls = []
  const setDataCalls = []
  const storage = Object.assign({}, initialStorage)

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      setDataCalls.push(patch)
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    navigateTo(options) {
      navigateCalls.push(options)
    },
    switchTab(options) {
      switchTabCalls.push(options)
    },
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    removeStorageSync(key) {
      delete storage[key]
    },
  }

  delete require.cache[require.resolve('./chapter-list')]
  const moduleExports = require('./chapter-list')

  return { pageConfig, moduleExports, navigateCalls, switchTabCalls, setDataCalls, storage }
}

test('章节选择页在 app.json 注册', () => {
  const appJson = fs.readFileSync(path.join(__dirname, '../../../../app.json'), 'utf8')

  assert.equal(appJson.includes('pages/chapter-list/chapter-list'), true)
})

test('章节选择页展示可点击章节卡片和空状态', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'chapter-list.wxml'), 'utf8')

  assert.equal(wxml.includes('wx:for="{{chapters}}"'), true)
  assert.equal(wxml.includes('data-chapter-id="{{item.id}}"'), true)
  assert.equal(wxml.includes('还没有漫画章节，先去写一篇日记吧'), true)
})

test('章节选择页合并 mock 和本地生成章节且不修改原 storage', () => {
  const storedChapter = {
    id: 'local-001',
    title: '本地章节',
    date: '2026-05-20',
    pages: [{ pageId: 'local-page', images: ['local.png'] }],
  }
  const { pageConfig, storage } = loadPage({
    generatedComicChapters: [storedChapter],
  })

  pageConfig.onLoad()

  assert.equal(pageConfig.data.chapters[0].id, 'local-001')
  assert.equal(pageConfig.data.chapters.some((chapter) => chapter.id === 'chapter-003'), true)
  assert.deepEqual(storage.generatedComicChapters, [storedChapter])
})

test('章节选择页按日期倒序并去重', () => {
  const { moduleExports } = loadPage()
  const chapters = moduleExports.buildChapterList([
    { id: 'chapter-001', title: '旧章节', date: '2026-05-16', pages: [] },
    { id: 'same', title: '保留最新', date: '2026-05-20', pages: [] },
  ], [
    { id: 'same', title: '重复旧数据', date: '2026-05-17', pages: [] },
    { id: 'local-001', title: '本地新章', createdAt: '2026-05-19T10:00:00.000Z', pages: [] },
  ])

  assert.deepEqual(chapters.map((chapter) => chapter.id), ['same', 'local-001', 'chapter-001'])
})

test('点击章节进入阅读器并携带 chapterId', () => {
  const { pageConfig, navigateCalls } = loadPage()

  pageConfig.openChapter({ currentTarget: { dataset: { chapterId: 'chapter-002' } } })

  assert.deepEqual(navigateCalls[0], {
    url: '/subpackage/packageA/pages/continuous-chapter/continuous-chapter?chapterId=chapter-002',
  })
})
