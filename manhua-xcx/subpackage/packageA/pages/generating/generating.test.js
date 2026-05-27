const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

function loadPage(storageSeed = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const switchTabCalls = []
  const requestCalls = []
  const storage = Object.assign({}, storageSeed)
  const intervals = []
  const infoCalls = []

  console.info = (...args) => {
    infoCalls.push(args)
  }

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
    switchTab(options) {
      switchTabCalls.push(options)
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

  delete require.cache[require.resolve('../../../../utils/api')]
  delete require.cache[require.resolve('../../../../utils/auth')]
  delete require.cache[require.resolve('../../../../utils/diaryApi')]
  delete require.cache[require.resolve('../../../../utils/diarySync')]
  delete require.cache[require.resolve('../../../../utils/generationTaskApi')]
  delete require.cache[require.resolve('./generating')]
  const moduleExports = require('./generating')
  pageConfig.moduleExports = moduleExports

  return { pageConfig, navigateCalls, switchTabCalls, requestCalls, storage, moduleExports, intervals, infoCalls }
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

async function runProgressToComplete(intervals) {
  let timer = await waitForInterval(intervals)
  for (let index = 0; index < 12; index += 1) {
    if (!timer || timer.cleared) {
      return
    }

    await runTimer(timer)
    timer = intervals[intervals.length - 1]
  }
}

test('生成中页仍显示模拟进度而不是空壳', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'generating.wxml'), 'utf8')

  assert.equal(wxml.includes('stage-title'), true)
  assert.equal(wxml.includes('step-track'), true)
})

test('generation page shows processing title and later button before completion', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'generating.wxml'), 'utf8')

  assert.equal(wxml.includes('{{generationTitle}}'), true)
  assert.equal(wxml.includes('稍后查看'), true)
  assert.equal(wxml.includes("wx:elif=\"{{generationStatus === 'completed' && canViewChapter}}\""), true)
})

test('later button switches back to home tab', () => {
  const { pageConfig, switchTabCalls } = loadPage()

  pageConfig.goHome()

  assert.deepEqual(switchTabCalls[0], {
    url: '/pages/index/index',
  })
})

test('loading failed task status shows retry state instead of later button state', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-failed-load',
          status: 'failed',
          diaryEntryId: 'entry-failed-load',
          result: {},
          errorMessage: 'OpenAI image generation timed out',
        },
      },
    })
  })

  pageConfig.onLoad({
    taskId: 'task-failed-load',
    taskStatus: 'processing',
  })
  await flushAsyncWork()

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/generation-tasks/task-failed-load')
  assert.equal(pageConfig.data.generationStatus, 'failed')
  assert.equal(pageConfig.data.generationFailureTitle, '生成失败')
  assert.equal(pageConfig.data.generationFailureMessage, '漫画生成超时，请重新生成')
  assert.equal(pageConfig.data.canViewChapter, false)
})

test('loading processing task status keeps later button state', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-processing-load',
          status: 'processing',
          diaryEntryId: 'entry-processing-load',
          result: {},
        },
      },
    })
  })

  pageConfig.onLoad({
    taskId: 'task-processing-load',
    taskStatus: 'processing',
  })
  await flushAsyncWork()

  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(pageConfig.data.generationTitle, '正在生成中')
  assert.equal(pageConfig.data.generationFailureTitle, '')
  assert.equal(pageConfig.data.canViewChapter, false)
})

test('loading completed task overrides stale failed state and writes real image', async () => {
  const { pageConfig, requestCalls, storage } = loadPage({
    authToken: 'token-task',
    draftComicChapter: {
      serverDiaryEntryId: 'entry-completed-load',
      generationTaskId: 'task-completed-load',
      generationTaskStatus: 'failed',
      chapterTitle: 'completed after failed',
      pageCount: 2,
    },
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-completed-load',
          status: 'completed',
          diaryEntryId: 'entry-completed-load',
          result: {
            pages: [{ imageUrl: '/uploads/generated/completed-after-failed.png' }],
          },
        },
      },
    })
  })

  pageConfig.onLoad({
    taskId: 'task-completed-load',
    taskStatus: 'failed',
  })
  await flushAsyncWork()

  const imageUrl = 'http://127.0.0.1:3000/uploads/generated/completed-after-failed.png'

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/generation-tasks/task-completed-load')
  assert.equal(pageConfig.data.generationStatus, 'completed')
  assert.equal(pageConfig.data.generationFailureTitle, '')
  assert.equal(pageConfig.data.canViewChapter, true)
  assert.equal(storage.generatedComicChapters[0].generationTaskStatus, 'completed')
  assert.equal(storage.generatedComicChapters[0].imageUrl, imageUrl)
  assert.equal(storage.generatedComicChapters[0].coverImageUrl, imageUrl)
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], imageUrl)
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
    url: '/subpackage/packageA/pages/continuous-chapter/continuous-chapter?chapterId=' + storage.generatedComicChapters[0].id,
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
            pages: [{ pageIndex: 0, imageUrl: '/uploads/generated/task-1.png' }],
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
    pages: [{ pageIndex: 0, imageUrl: '/uploads/generated/task-1.png' }],
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
  const { pageConfig, moduleExports, requestCalls, storage, intervals } = loadPage({
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
  }, pageConfig)
  await flushAsyncWork()

  assert.equal(requestCalls.length, 1)
  const pollTimer = await waitForInterval(intervals)
  assert.equal(intervals.length, 1)
  assert.equal(pollTimer.delay, 2500)

  await runTimer(pollTimer)
  const chapter = await pending

  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks/task-pending')
  assert.equal(requestCalls[1].method, 'GET')
  assert.equal(pageConfig.data.generationTaskId, 'task-pending')
  assert.equal(pageConfig.data.generationTaskStatus, 'completed')
  assert.equal(chapter.pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(chapter.pages[0].imageUrl, 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(storage.generatedComicChapters[0].pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(storage.generatedComicChapters[0].pages[0].imageUrl, 'http://127.0.0.1:3000/uploads/generated/polled-first-page.png')
  assert.equal(pollTimer.cleared, true)
})

test('old draft generationTaskId cannot override newly created task id while polling', async () => {
  const { pageConfig, moduleExports, requestCalls, intervals } = loadPage({
    authToken: 'token-task',
    draftComicChapter: {
      serverDiaryEntryId: 'entry-new',
      generationTaskId: 'task-old-draft',
      generationTaskStatus: 'processing',
      generationResult: {
        pages: [{ imageUrl: '/uploads/generated/old-draft.png' }],
      },
    },
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'task-new',
            status: 'processing',
            diaryEntryId: 'entry-new',
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
          id: 'task-new',
          status: 'completed',
          diaryEntryId: 'entry-new',
          result: {
            pages: [{ imageUrl: '/uploads/generated/new-task.png' }],
          },
        },
      },
    })
  })

  const pending = moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-new',
    generationTaskId: 'task-old-draft',
    generationTaskStatus: 'processing',
    generationResult: {
      pages: [{ imageUrl: '/uploads/generated/old-draft.png' }],
    },
    chapterTitle: 'new task chapter',
  }, pageConfig)
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks/task-new')
  assert.equal(pageConfig.data.generationTaskId, 'task-new')
  assert.equal(chapter.generationTaskId, 'task-new')
  assert.equal(chapter.pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/new-task.png')
})

test('old generated chapters do not affect current generation polling id', async () => {
  const { pageConfig, moduleExports, requestCalls, intervals } = loadPage({
    authToken: 'token-task',
    generatedComicChapters: [{
      id: 'chapter-old',
      generationTaskId: 'task-old-chapter',
      generationResult: {
        pages: [{ imageUrl: '/uploads/generated/old-chapter.png' }],
      },
    }],
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 'task-new-from-post',
            status: 'pending',
            diaryEntryId: 'entry-current',
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
          id: 'task-new-from-post',
          status: 'completed',
          diaryEntryId: 'entry-current',
          result: {
            pages: [{ imageUrl: '/uploads/generated/current.png' }],
          },
        },
      },
    })
  })

  const pending = moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-current',
    chapterTitle: 'current chapter',
  }, pageConfig)
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks/task-new-from-post')
  assert.equal(pageConfig.data.generationTaskId, 'task-new-from-post')
  assert.equal(chapter.generationTaskId, 'task-new-from-post')
  assert.equal(chapter.pages[0].images[0], 'http://127.0.0.1:3000/uploads/generated/current.png')
})

test('new backend generation clears stale page task state and old poll timer', async () => {
  const { pageConfig, moduleExports, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: intervals.length === 0 ? 'task-first' : 'task-second',
          status: 'pending',
          diaryEntryId: 'entry-reset',
          result: {},
        },
      },
    })
  })

  pageConfig.setData({
    generationTaskId: 'task-stale',
    generationTaskStatus: 'processing',
    generationResult: {
      pages: [{ imageUrl: '/uploads/generated/stale.png' }],
    },
  })

  moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-reset',
    chapterTitle: 'first task',
  }, pageConfig).catch(() => null)
  await waitForInterval(intervals)
  const firstTimer = intervals[0]

  moduleExports.finalizeGeneratedChapterWithBackendFallback({
    serverDiaryEntryId: 'entry-reset',
    chapterTitle: 'second task',
  }, pageConfig).catch(() => null)
  await flushAsyncWork()
  await flushAsyncWork()

  assert.equal(firstTimer.cleared, true)
  assert.equal(pageConfig.data.generationTaskId, 'task-second')
  assert.equal(pageConfig.data.generationTaskStatus, 'pending')
  assert.deepEqual(pageConfig.data.generationResult, {})
})

test('failed polled generation task enters failed state without writing local success chapter', async () => {
  const { pageConfig, moduleExports, storage, intervals, navigateCalls } = loadPage({
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
  }, pageConfig)
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(chapter, null)
  assert.equal(pageConfig.data.generationStatus, 'failed')
  assert.equal(pageConfig.data.generationFailureTitle, '生成失败')
  assert.equal(pageConfig.data.generationFailureMessage, '漫画生成超时，请重新生成')
  assert.equal(pageConfig.data.generationTaskStatus, 'failed')
  assert.equal(storage.generatedComicChapters, undefined)
  assert.equal(navigateCalls.length, 0)
})

test('polling get failure keeps processing state without writing local success chapter', async () => {
  const { pageConfig, moduleExports, storage, intervals } = loadPage({
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
  }, pageConfig)
  await flushAsyncWork()
  await runTimer(await waitForInterval(intervals))
  const chapter = await pending

  assert.equal(chapter, null)
  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(pageConfig.data.generationTitle, '正在生成中')
  assert.equal(pageConfig.data.generationFailureTitle, '')
  assert.equal(pageConfig.data.generationTaskStatus, 'pending')
  assert.equal(storage.generatedComicChapters, undefined)
})

test('retry generation creates a new backend task after failed state', async () => {
  const { pageConfig, requestCalls, intervals, storage } = loadPage({
    authToken: 'token-task',
    draftComicChapter: {
      serverDiaryEntryId: 'entry-retry',
      chapterTitle: 'retry chapter',
      pageCount: 2,
    },
  }, (options) => {
    if (options.method === 'POST') {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: `task-retry-${requestCalls.length + 1}`,
            status: 'failed',
            diaryEntryId: 'entry-retry',
            result: {},
          },
        },
      })
    }
  })

  pageConfig.onLoad()
  await runProgressToComplete(intervals)
  await flushAsyncWork()

  assert.equal(pageConfig.data.generationStatus, 'failed')
  assert.equal(requestCalls.length, 1)

  pageConfig.retryGeneration()
  await runProgressToComplete(intervals)
  await flushAsyncWork()

  assert.equal(requestCalls.length, 2)
  assert.equal(requestCalls[1].url, 'http://127.0.0.1:3000/api/generation-tasks')
  assert.equal(requestCalls[1].data.diaryEntryId, 'entry-retry')
  assert.equal(pageConfig.data.generationStatus, 'failed')
  assert.equal(storage.generatedComicChapters, undefined)
})

test('polling max count uses final completed task result before showing fallback state', async () => {
  let getCount = 0
  const { pageConfig, moduleExports, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    getCount += 1
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-timeout-completed',
          status: getCount > moduleExports.generationTaskMaxPollCount ? 'completed' : 'processing',
          diaryEntryId: 'entry-timeout-completed',
          result: getCount > moduleExports.generationTaskMaxPollCount
            ? { pages: [{ imageUrl: '/uploads/generated/final-check.png' }] }
            : {},
        },
      },
    })
  })

  const pending = moduleExports.waitForGenerationTaskResult({
    id: 'task-timeout-completed',
    status: 'processing',
    diaryEntryId: 'entry-timeout-completed',
    result: {},
  }, pageConfig)
  const pollTimer = await waitForInterval(intervals)

  for (let index = 0; index < moduleExports.generationTaskMaxPollCount + 1; index += 1) {
    await runTimer(pollTimer)
  }

  const task = await pending

  assert.equal(task.status, 'completed')
  assert.equal(moduleExports.getFirstGenerationImageUrl(task), 'http://127.0.0.1:3000/uploads/generated/final-check.png')
  assert.equal(pageConfig.data.generationTaskStatus, 'completed')
  assert.equal(pollTimer.cleared, true)
})

test('polling max count keeps processing when final task is still processing', async () => {
  const { pageConfig, moduleExports, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'task-timeout',
          status: 'processing',
          diaryEntryId: 'entry-timeout',
          result: {},
        },
      },
    })
  })

  const pending = moduleExports.waitForGenerationTaskResult({
    id: 'task-timeout',
    status: 'processing',
    diaryEntryId: 'entry-timeout',
    result: {},
  }, pageConfig)
  const pollTimer = await waitForInterval(intervals)

  for (let index = 0; index < moduleExports.generationTaskMaxPollCount + 1; index += 1) {
    await runTimer(pollTimer)
  }

  const task = await pending

  assert.equal(task.status, 'processing')
  assert.equal(pageConfig.data.generationTaskStatus, 'processing')
  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(pageConfig.data.generationTitle, '正在生成中')
  assert.equal(pageConfig.data.generationFailureTitle, '')
  assert.equal(pollTimer.cleared, true)
})

test('polling max count keeps processing when final task lookup fails', async () => {
  const { pageConfig, moduleExports, intervals } = loadPage({
    authToken: 'token-task',
  }, (options) => {
    options.fail(new Error('temporary network error'))
  })

  const pending = moduleExports.waitForGenerationTaskResult({
    id: 'task-timeout-get-fail',
    status: 'processing',
    diaryEntryId: 'entry-timeout-get-fail',
    result: {},
  }, pageConfig)
  const pollTimer = await waitForInterval(intervals)

  for (let index = 0; index < moduleExports.generationTaskMaxPollCount + 1; index += 1) {
    await runTimer(pollTimer)
  }

  const task = await pending

  assert.equal(task.status, 'processing')
  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(pageConfig.data.generationFailureTitle, '')
  assert.equal(pollTimer.cleared, true)
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

test('completed generation task without imageUrl keeps processing state without local success chapter', async () => {
  const { pageConfig, moduleExports, storage } = loadPage({
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
  }, pageConfig)

  assert.equal(chapter, null)
  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(storage.generatedComicChapters, undefined)
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
          result: {
            pages: [{ imageUrl: '/uploads/generated/created.png' }],
          },
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

test('generation task create failure keeps processing state without writing local success chapter', async () => {
  const { pageConfig, moduleExports, requestCalls, storage } = loadPage({
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
  }, pageConfig)

  assert.equal(requestCalls.length, 1)
  assert.equal(chapter, null)
  assert.equal(pageConfig.data.generationStatus, 'processing')
  assert.equal(pageConfig.data.generationTaskStatus, 'processing')
  assert.equal(storage.generatedComicChapters, undefined)
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
          result: {
            pages: [{ imageUrl: '/uploads/generated/nav.png' }],
          },
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
    url: '/subpackage/packageA/pages/continuous-chapter/continuous-chapter?chapterId=' + chapter.id,
  })
})
