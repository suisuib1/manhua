const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage() {
  let pageConfig
  const navigateCalls = []
  const storage = {}

  global.Page = (config) => {
    pageConfig = config
    pageConfig.setData = (patch) => {
      pageConfig.data = Object.assign({}, pageConfig.data, patch)
    }
  }

  global.wx = {
    navigateTo(options) {
      navigateCalls.push(options)
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    getStorageSync(key) {
      return storage[key]
    },
    removeStorageSync(key) {
      delete storage[key]
    },
    showToast() {},
  }

  delete require.cache[require.resolve('./generating')]
  const moduleExports = require('./generating')
  pageConfig.moduleExports = moduleExports

  return { pageConfig, navigateCalls, storage, moduleExports }
}

test('生成中页仍显示模拟进度而不是空壳', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'generating.wxml'), 'utf8')

  assert.equal(wxml.includes('stage-title'), true)
  assert.equal(wxml.includes('step-track'), true)
})

test('有草稿时能构造生成章节', () => {
  const { moduleExports } = loadPage()

  const chapter = moduleExports.buildGeneratedChapter({
    chapterTitle: '和小猫一起的傍晚',
    diaryDate: '2026-05-18',
    diaryText: '今天很温柔',
    photoPath: '/tmp/photo-a.png',
    pageCount: 2,
    selectedTags: ['warm', 'cute'],
  })

  assert.equal(chapter.title, '和小猫一起的傍晚')
  assert.equal(chapter.pages.length, 2)
  assert.equal(chapter.pages[0].images[0], '/tmp/photo-a.png')
  assert.ok(chapter.summary.includes('今天很温柔'))
})

test('没有图片时会回退到默认漫画图片', () => {
  const { moduleExports } = loadPage()

  const chapter = moduleExports.buildGeneratedChapter({
    chapterTitle: '下雨天的宅家',
    diaryDate: '2026-05-17',
    diaryText: '窗边的雨',
    photoItem: null,
    pageCount: 1,
    selectedTags: ['healing'],
  })

  assert.equal(chapter.pages.length, 2)
  assert.equal(Array.isArray(chapter.pages[0].images), true)
  assert.ok(chapter.pages[0].images.length > 0)
})

test('完成后会写入本地存储并进入漫画书阅读器', () => {
  const { pageConfig, navigateCalls, storage } = loadPage()
  const generatedChapter = pageConfig.moduleExports
    ? pageConfig.moduleExports.finalizeGeneratedChapter({
        chapterTitle: '和小猫一起的傍晚',
        diaryDate: '2026-05-18',
        pageCount: '2',
        diaryText: '今天很温柔',
        photoPath: '/tmp/photo-a.png',
      })
    : require('./generating').finalizeGeneratedChapter({
        chapterTitle: '和小猫一起的傍晚',
        diaryDate: '2026-05-18',
        pageCount: '2',
        diaryText: '今天很温柔',
        photoPath: '/tmp/photo-a.png',
      })

  pageConfig.setData({
    generatedChapterId: generatedChapter.id,
  })
  pageConfig.goChapterDetail()

  assert.equal(storage.generatedComicChapters.length, 1)
  assert.equal(storage.generatedComicChapters[0].title, '和小猫一起的傍晚')
  assert.deepEqual(navigateCalls[0], {
    url: '/pages/continuous-chapter/continuous-chapter?chapterId=' + storage.generatedComicChapters[0].id,
  })
})
