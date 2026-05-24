const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storageSeed = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const requestCalls = []
  const storage = Object.assign({}, storageSeed)
  const intervals = []

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
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    removeStorageSync(key) {
      delete storage[key]
    },
    showToast() {},
  }

  global.setInterval = (handler, delay) => {
    const timer = {
      handler,
      delay,
      cleared: false,
    }
    intervals.push(timer)
    return timer
  }
  global.clearInterval = (timer) => {
    if (timer) {
      timer.cleared = true
    }
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  delete require.cache[require.resolve('../../utils/diaryApi')]
  delete require.cache[require.resolve('../../utils/diarySync')]
  delete require.cache[require.resolve('../../utils/generationTaskApi')]
  delete require.cache[require.resolve('./generating')]
  const moduleExports = require('./generating')
  pageConfig.moduleExports = moduleExports

  return { pageConfig, navigateCalls, requestCalls, storage, moduleExports, intervals }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

async function waitForInterval(intervals) {
  for (let index = 0; index < 10; index += 1) {
    if (intervals.length > 0) {
      return intervals[intervals.length - 1]
    }

    await flushAsyncWork()
  }

  return intervals[intervals.length - 1]
}

async function runTimer(timer) {
  timer.handler()
  await flushAsyncWork()
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

test('unauthenticated generation keeps local fallback', async () => {
  const { moduleExports, requestCalls, storage } = loadPage()

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    chapterTitle: 'local chapter',
    diaryDate: '2026-05-21',
    diaryText: 'local generation',
    pageCount: 2,
  })
  await flushAsyncWork()

  assert.equal(requestCalls.length, 0)
  assert.equal(storage.generatedComicChapters.length, 1)
  assert.equal(chapter.title, 'local chapter')
  assert.equal(chapter.generationTaskId, undefined)
})

test('generation task success adds backend metadata without changing reader pages', async () => {
  const { moduleExports, requestCalls, storage } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-1',
          status: 'completed',
          diaryEntryId: 'entry-1',
          result: {
            pages: [{ pageIndex: 0, mock: true }],
          },
        },
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-1',
    chapterTitle: 'backend task chapter',
    diaryDate: '2026-05-21',
    diaryText: 'keep local reader data',
    pageCount: 2,
  })

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/generation-tasks')
  assert.equal(requestCalls[0].method, 'POST')
  assert.equal(requestCalls[0].data.diaryEntryId, 'entry-1')
  assert.equal(chapter.generationTaskId, 'task-1')
  assert.equal(chapter.generationTaskStatus, 'completed')
  assert.equal(chapter.serverDiaryEntryId, 'entry-1')
  assert.deepEqual(chapter.generationResult, {
    pages: [{ pageIndex: 0, mock: true }],
  })
  assert.equal(Array.isArray(chapter.pages), true)
  assert.equal(storage.generatedComicChapters[0].id, chapter.id)
})

test('generation task result imageUrl is injected into first local reader page as full resource url', async () => {
  const { moduleExports, storage } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-ai-image',
          status: 'completed',
          diaryEntryId: 'entry-ai-image',
          result: {
            pages: [
              {
                pageIndex: 0,
                imageUrl: '/uploads/generated/ai-first-page.png',
                mock: false,
              },
            ],
          },
        },
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-ai-image',
    chapterTitle: 'ai image chapter',
    diaryDate: '2026-05-21',
    diaryText: 'show ai image in reader',
    pageCount: 2,
  })

  assert.equal(chapter.pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/ai-first-page.png')
  assert.equal(chapter.images[0], 'http://127.0.0.1:3000/uploads/generated/ai-first-page.png')
  assert.equal(chapter.imageUrl, 'http://127.0.0.1:3000/uploads/generated/ai-first-page.png')
  assert.equal(chapter.coverImageUrl, 'http://127.0.0.1:3000/uploads/generated/ai-first-page.png')
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/ai-first-page.png')
  assert.equal(chapter.generationResult.pages[0].imageUrl, '/uploads/generated/ai-first-page.png')
})

test('pending generation task polls until completed and injects first image', async () => {
  const { moduleExports, requestCalls, storage, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'task-pending',
            status: 'pending',
            diaryEntryId: 'entry-pending',
            result: {},
          },
        },
      })
      return
    }

    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-pending',
          status: 'completed',
          diaryEntryId: 'entry-pending',
          result: {
            pages: [{
              pageIndex: 0,
              imageUrl: '/uploads/generated/polled-first-page.png',
              mock: false,
            }],
          },
        },
      },
    })
  })

  const pending = moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-pending',
    chapterTitle: 'pending chapter',
    pageCount: 2,
  })
  await flushAsyncWork()

  assert.equal(requestCalls.length, 1)
  const pollTimer = await waitForInterval(intervals)
  assert.equal(intervals.length, 1)
  assert.equal(pollTimer.delay, 2500)

  await runTimer(pollTimer)
  const chapter = await pending

  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks/task-pending')
  assert.equal(requestCalls[1].method, 'GET')
  assert.equal(chapter.pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(pollTimer.cleared, true)
})

test('failed polled generation task writes local fallback', async () => {
  const { moduleExports, storage, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'task-failed',
            status: 'processing',
            diaryEntryId: 'entry-failed',
            result: {},
          },
        },
      })
      return
    }

    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-failed',
          status: 'failed',
          diaryEntryId: 'entry-failed',
          result: {},
          errorMessage: 'OpenAI failed',
        },
      },
    })
  })

  const pending = moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-failed',
    chapterTitle: 'failed chapter',
    pageCount: 2,
  })
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(chapter.generationTaskId, undefined)
  assert.equal(storage.generatedComicChapters.length, 1)
  assert.equal(storage.generatedComicChapters[0].title, 'failed chapter')
})

test('polling get failure writes local fallback', async () => {
  const { moduleExports, storage, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'task-get-fail',
            status: 'pending',
            diaryEntryId: 'entry-get-fail',
            result: {},
          },
        },
      })
      return
    }

    options.fail(new Error('timeout'))
  })

  const pending = moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-get-fail',
    chapterTitle: 'get fail chapter',
    pageCount: 2,
  })
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(chapter.generationTaskId, undefined)
  assert.equal(storage.generatedComicChapters[0].title, 'get fail chapter')
})

test('onUnload clears polling timer', async () => {
  const { pageConfig, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-unload',
          status: 'pending',
          diaryEntryId: 'entry-unload',
          result: {},
        },
      },
    })
  })

  pageConfig.setData({
    pendingDraft: {
      serverDiaryEntryId: 'entry-unload',
      chapterTitle: 'unload chapter',
    },
  })
  pageConfig.moduleExports.finalizeGeneratedChapterWithBackendFallback(pageConfig.data.pendingDraft)
    .catch(() => null)
  await waitForInterval(intervals)

  pageConfig.onUnload()

  assert.equal(intervals.some((timer) => timer.cleared), true)
})

test('generation task without imageUrl keeps local reader fallback image', async () => {
  const { moduleExports } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-no-image',
          status: 'completed',
          diaryEntryId: 'entry-no-image',
          result: {
            pages: [{ pageIndex: 0, mock: true }],
          },
        },
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-no-image',
    chapterTitle: 'fallback image chapter',
    diaryDate: '2026-05-21',
    diaryText: 'keep fallback image',
    pageCount: 2,
  })

  assert.notEqual(chapter.pages[0].images[0], '/uploads/generated/ai-first-page.png')
  assert.equal(chapter.pages[0].images[0].startsWith('/subpackage/'), true)
})

test('missing serverDiaryEntryId syncs diary before creating generation task', async () => {
  const { moduleExports, requestCalls, storage } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    if (options.url.endsWith('/api/diary-entries')) {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'entry-created',
          },
        },
      })
      return
    }

    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-created',
          status: 'completed',
          diaryEntryId: 'entry-created',
          result: {},
        },
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    chapterTitle: 'sync first chapter',
    diaryDate: '2026-05-21',
    diaryText: 'sync diary before task',
    pageCount: 2,
  })

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries')
  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks')
  assert.equal(requestCalls[1].data.diaryEntryId, 'entry-created')
  assert.equal(storage.draftComicChapter.serverDiaryEntryId, 'entry-created')
  assert.equal(chapter.generationTaskId, 'task-created')
})

test('generation task failure still writes local generated chapter', async () => {
  const { moduleExports, requestCalls, storage } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 500,
      data: {
        code: 500,
        message: 'server error',
        data: null,
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-fail',
    chapterTitle: 'fallback chapter',
    diaryDate: '2026-05-21',
    diaryText: 'backend failed',
    pageCount: 2,
  })

  assert.equal(requestCalls.length, 1)
  assert.equal(storage.generatedComicChapters.length, 1)
  assert.equal(chapter.title, 'fallback chapter')
  assert.equal(chapter.generationTaskId, undefined)
})

test('generation task metadata does not change reader navigation', async () => {
  const { pageConfig, navigateCalls, storage, moduleExports } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-nav',
          status: 'completed',
          diaryEntryId: 'entry-nav',
          result: {},
        },
      },
    })
  })

  const chapter = await moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-nav',
    chapterTitle: 'reader chapter',
  })

  pageConfig.setData({
    generatedChapterId: chapter.id,
  })
  pageConfig.goChapterDetail()

  assert.equal(storage.generatedComicChapters[0].generationTaskId, 'task-nav')
  assert.deepEqual(navigateCalls[0], {
    url: '/pages/continuous-chapter/continuous-chapter?chapterId=' + chapter.id,
  })
})
