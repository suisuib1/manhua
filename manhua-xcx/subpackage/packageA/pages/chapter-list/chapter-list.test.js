const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(initialStorage = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const switchTabCalls = []
  const setDataCalls = []
  const requestCalls = []
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
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
  }

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/auth')]
  delete require.cache[require.resolve('../../../../utils/comicChapterApi')]
  delete require.cache[require.resolve('../../../../utils/chapterCatalog')]
  delete require.cache[require.resolve('./chapter-list')]
  const moduleExports = require('./chapter-list')

  return { pageConfig, moduleExports, navigateCalls, switchTabCalls, setDataCalls, requestCalls, storage }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
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

  assert.equal(pageConfig.data.chapters.length, 0)
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

test('logged in chapter list loads real chapters and hides mock titles', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-chapter-list',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-real-list',
              title: '真实散步章节',
              date: '2026-05-28',
              status: 'completed',
              pageCount: 1,
              coverImageUrl: '/uploads/generated/list.png',
            },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/comic-chapters/recent')
  assert.deepEqual(requestCalls[0].data, { limit: 50 })
  assert.deepEqual(pageConfig.data.chapters.map((chapter) => chapter.title), ['真实散步章节'])
  assert.equal(pageConfig.data.chapters.some((chapter) => chapter.subtitle === '春日野餐记'), false)
  assert.equal(pageConfig.data.hasChapters, true)
})

test('logged out chapter list does not request backend or show mock chapters', async () => {
  const { pageConfig, requestCalls } = loadPage()

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls.length, 0)
  assert.deepEqual(pageConfig.data.chapters, [])
  assert.equal(pageConfig.data.hasChapters, false)
})

test('chapter list request failure does not fallback to mock chapters', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-chapter-list',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onLoad()
  await flushAsyncWork()

  assert.equal(requestCalls.length, 1)
  assert.deepEqual(pageConfig.data.chapters, [])
  assert.equal(pageConfig.data.hasChapters, false)
})

test('clicking real chapters routes by generation status', async () => {
  const { pageConfig, navigateCalls, storage } = loadPage({
    authToken: 'token-chapter-list',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-completed',
              title: 'completed',
              status: 'completed',
              pageCount: 1,
              coverImageUrl: '/uploads/generated/completed.png',
              generationTaskId: 'task-completed',
            },
            {
              id: 'entry-processing',
              title: 'processing',
              status: 'processing',
              generationTaskId: 'task-processing',
            },
            {
              id: 'entry-failed',
              title: 'failed',
              status: 'failed',
              generationTaskId: 'task-failed',
            },
          ],
        },
      },
    })
  })

  await pageConfig.onLoad()
  await flushAsyncWork()

  pageConfig.openChapter({ currentTarget: { dataset: { chapterId: 'entry-completed' } } })
  pageConfig.openChapter({ currentTarget: { dataset: { chapterId: 'entry-processing' } } })
  pageConfig.openChapter({ currentTarget: { dataset: { chapterId: 'entry-failed' } } })

  assert.deepEqual(navigateCalls, [
    { url: '/subpackage/packageA/pages/continuous-chapter/continuous-chapter?chapterId=entry-completed' },
    { url: '/subpackage/packageA/pages/generating/generating?taskId=task-processing&taskStatus=processing' },
    { url: '/subpackage/packageA/pages/generating/generating?taskId=task-failed&taskStatus=failed' },
  ])
  assert.equal(storage.generatedComicChapters[0].id, 'entry-completed')
  assert.equal(storage.generatedComicChapters[0].title, 'completed')
  assert.equal(storage.generatedComicChapters[0].coverImageUrl, '/uploads/generated/completed.png')
  assert.equal(storage.draftComicChapter.generationTaskId, 'task-failed')
  assert.equal(storage.draftComicChapter.generationTaskStatus, 'failed')
})
