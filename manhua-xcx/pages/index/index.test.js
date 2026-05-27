const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('home page does not render the in-page custom title bar', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')
  const wxss = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8')

  assert.equal(wxml.includes('home-navbar'), false)
  assert.equal(wxml.includes('home-nav-title'), false)
  assert.equal(wxml.includes('navBarHeight'), false)
  assert.equal(wxss.includes('.home-navbar'), false)
  assert.equal(wxss.includes('.home-nav-title'), false)
})

test('home page keeps the core entry content', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('user.greetingTitle'), true)
  assert.equal(wxml.includes('defaultComicBook.title'), true)
  assert.equal(wxml.includes('goCreateChapter'), true)
})

test('unauthenticated create entry opens login modal without switching tab', () => {
  const { pageConfig, switchTabCalls } = loadPage()

  pageConfig.goCreateChapter()

  assert.equal(pageConfig.data.showLoginModal, true)
  assert.equal(switchTabCalls.length, 0)
})

test('unauthenticated recent chapter opens login modal without opening reader', () => {
  const { pageConfig, navigateCalls } = loadPage()

  pageConfig.goChapterDetail({
    currentTarget: {
      dataset: {
        id: 'chapter-002',
      },
    },
  })

  assert.equal(pageConfig.data.showLoginModal, true)
  assert.equal(navigateCalls.length, 0)
})

test('unauthenticated quick entries open login modal without navigating', () => {
  const { pageConfig, navigateCalls, switchTabCalls } = loadPage()

  pageConfig.goCharacter()
  pageConfig.closeLoginModal()
  pageConfig.goMine()

  assert.equal(pageConfig.data.showLoginModal, true)
  assert.equal(navigateCalls.length, 0)
  assert.equal(switchTabCalls.length, 0)
})

test('authenticated create entry keeps original switch tab behavior', () => {
  const { pageConfig, switchTabCalls } = loadPage({
    authToken: 'token-home',
  })

  pageConfig.goCreateChapter()

  assert.deepEqual(switchTabCalls[0], {
    url: '/pages/create/create',
  })
  assert.equal(pageConfig.data.showLoginModal, false)
})

test('authenticated character and mine entries keep original navigation behavior', () => {
  const { pageConfig, navigateCalls, switchTabCalls } = loadPage({
    authToken: 'token-home',
  })

  pageConfig.goCharacter()
  pageConfig.goMine()

  assert.deepEqual(navigateCalls[0], {
    url: '/pages/character/character',
  })
  assert.deepEqual(switchTabCalls[0], {
    url: '/pages/mine/mine',
  })
})

test('closing login modal hides it', () => {
  const { pageConfig } = loadPage()

  pageConfig.goCharacter()
  pageConfig.closeLoginModal()

  assert.equal(pageConfig.data.showLoginModal, false)
})

test('confirming login uses existing auth flow and refreshes recent chapters', async () => {
  const { pageConfig, requestCalls, storage } = loadPage({}, (options) => {
    if (options.url.endsWith('/api/auth/wechat/login')) {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            token: 'token-home-login',
            user: {
              id: 'user-home-login',
              nickname: '灏忔弧',
              avatarUrl: '',
            },
          },
        },
      })
      return
    }

    if (options.url.endsWith('/api/comic-chapters/recent')) {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            items: [],
          },
        },
      })
    }
  })

  pageConfig.goCreateChapter()
  await pageConfig.confirmLogin()

  assert.equal(storage.authToken, 'token-home-login')
  assert.equal(pageConfig.data.showLoginModal, false)
  assert.equal(requestCalls.some((options) => options.url.endsWith('/api/auth/wechat/login')), true)
  assert.equal(requestCalls.some((options) => options.url.endsWith('/api/comic-chapters/recent')), true)
})

test('confirming login shows simplified network error when request fails', async () => {
  const { pageConfig, toastCalls, storage } = loadPage({}, (options) => {
    options.fail({})
  })

  pageConfig.goCreateChapter()
  await pageConfig.confirmLogin()

  assert.equal(toastCalls[0].title, '网络连接失败，请检查服务是否已启动')
  assert.equal(toastCalls[0].icon, 'none')
  assert.equal(pageConfig.data.showLoginModal, true)
  assert.equal(storage.authToken, undefined)
})

function loadPage(storageSeed = {}, requestImpl = () => {}) {
  let pageConfig
  const navigateCalls = []
  const switchTabCalls = []
  const requestCalls = []
  const toastCalls = []
  const storage = Object.assign({}, storageSeed)

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
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    login(options) {
      options.success({ code: 'home_login_code' })
    },
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    showToast(options) {
      toastCalls.push(options)
    },
    getWindowInfo() {
      return { statusBarHeight: 20 }
    },
    getMenuButtonBoundingClientRect() {
      return null
    },
  }

  delete require.cache[require.resolve('../../utils/api')]
  delete require.cache[require.resolve('../../utils/auth')]
  try {
    delete require.cache[require.resolve('../../utils/comicChapterApi')]
  } catch (error) {
  }
  delete require.cache[require.resolve('./index')]
  const moduleExports = require('./index')

  return { pageConfig, navigateCalls, switchTabCalls, requestCalls, toastCalls, storage, moduleExports }
}

test('首页最近章节进入漫画书阅读器而不是旧章节详情', () => {
  const { pageConfig, navigateCalls } = loadPage({
    authToken: 'token-home',
  })

  pageConfig.goChapterDetail({
    currentTarget: {
      dataset: {
        id: 'chapter-002',
      },
    },
  })

  assert.deepEqual(navigateCalls[0], {
    url: '/pages/continuous-chapter/continuous-chapter?chapterId=chapter-002',
  })
})

test('首页最近章节卡片不再显示状态标签', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('chapter-status'), false)
  assert.equal(wxml.includes('status-dot'), false)
})

test('首页不展示更多章节占位提示卡片', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('memory-note'), false)
  assert.equal(wxml.includes('还没有更多章节时'), false)
  assert.equal(wxml.includes('home-empty-cat'), false)
})

test('unauthenticated home does not request recent comic chapters', async () => {
  const { pageConfig, requestCalls } = loadPage()

  await pageConfig.onShow()

  assert.equal(requestCalls.length, 0)
  assert.equal(pageConfig.data.recentChapters[0].id, 'chapter-003')
})

test('authenticated home requests recent comic chapters on show', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  await pageConfig.onShow()

  assert.equal(requestCalls.length, 1)
  assert.equal(requestCalls[0].url.endsWith('/api/comic-chapters/recent'), true)
  assert.equal(requestCalls[0].method, 'GET')
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-recent')
})

test('home does not duplicate recent request across load and show', async () => {
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  await pageConfig.onLoad()
  await pageConfig.onShow()

  assert.equal(requestCalls.length, 1)
})

test('home skips duplicate recent request while loading', async () => {
  let finishRequest
  const { pageConfig, requestCalls } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    finishRequest = () => options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  const firstLoad = pageConfig.onShow()
  const secondLoad = pageConfig.onShow()

  assert.equal(requestCalls.length, 1)

  finishRequest()
  await Promise.all([firstLoad, secondLoad])

  assert.equal(requestCalls.length, 1)
})

test('home uses backend recent chapters when items are returned', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'entry-1',
              title: '后端章节',
              date: '2026-05-22T00:00:00.000Z',
              summary: '后端摘要',
              status: 'completed',
              pageCount: 2,
              coverImageUrl: '/uploads/images/cover.png',
            },
          ],
        },
      },
    })
  })

  await pageConfig.onShow()

  assert.equal(pageConfig.data.recentChapters.length, 1)
  assert.equal(pageConfig.data.recentChapters[0].id, 'entry-1')
  assert.equal(pageConfig.data.recentChapters[0].title, '后端章节')
  assert.equal(pageConfig.data.recentChapters[0].summary, '后端摘要')
  assert.equal(pageConfig.data.recentChapters[0].coverImageUrl, 'http://127.0.0.1:3000/uploads/images/cover.png')
  assert.equal(pageConfig.data.recentChapters[0].pageCountText, '2 页')
})

test('home normalizes recent generated cover image into reader fields', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'cmpnhaac5000aqwkww3oozxlg',
              diaryEntryId: 'cmpnhaac5000aqwkww3oozxlg',
              generationTaskId: 'cmpnhbn7t000eqwkw3avjiwnl',
              title: '今天过生日',
              status: 'completed',
              pageCount: 1,
              coverImageUrl: '/uploads/generated/openai-1779851239962-m89cn9tu.png',
              hasComicImages: true,
            },
          ],
        },
      },
    })
  })

  await pageConfig.onShow()

  const chapter = pageConfig.data.recentChapters[0]
  const imageUrl = 'http://127.0.0.1:3000/uploads/generated/openai-1779851239962-m89cn9tu.png'

  assert.equal(chapter.coverImageUrl, imageUrl)
  assert.equal(chapter.imageUrl, imageUrl)
  assert.deepEqual(chapter.images, [imageUrl])
  assert.equal(chapter.pages[0].images[0], imageUrl)
})

test('clicking recent chapter caches reader chapter before navigating', async () => {
  const { pageConfig, navigateCalls, storage } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [
            {
              id: 'cmpnhaac5000aqwkww3oozxlg',
              diaryEntryId: 'cmpnhaac5000aqwkww3oozxlg',
              generationTaskId: 'cmpnhbn7t000eqwkw3avjiwnl',
              title: '今天过生日',
              status: 'completed',
              pageCount: 1,
              coverImageUrl: '/uploads/generated/openai-1779851239962-m89cn9tu.png',
              hasComicImages: true,
            },
          ],
        },
      },
    })
  })

  await pageConfig.onShow()
  pageConfig.goChapterDetail({
    currentTarget: {
      dataset: {
        id: 'cmpnhaac5000aqwkww3oozxlg',
      },
    },
  })

  const imageUrl = 'http://127.0.0.1:3000/uploads/generated/openai-1779851239962-m89cn9tu.png'
  const cachedChapter = storage.generatedComicChapters[0]

  assert.equal(cachedChapter.id, 'cmpnhaac5000aqwkww3oozxlg')
  assert.equal(cachedChapter.diaryEntryId, 'cmpnhaac5000aqwkww3oozxlg')
  assert.equal(cachedChapter.generationTaskId, 'cmpnhbn7t000eqwkw3avjiwnl')
  assert.equal(cachedChapter.coverImageUrl, imageUrl)
  assert.equal(cachedChapter.imageUrl, imageUrl)
  assert.deepEqual(cachedChapter.images, [imageUrl])
  assert.equal(cachedChapter.pages[0].images[0], imageUrl)
  assert.deepEqual(navigateCalls[0], {
    url: '/pages/continuous-chapter/continuous-chapter?chapterId=cmpnhaac5000aqwkww3oozxlg',
  })
})

test('home falls back to mock recent chapters when backend fails', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.fail(new Error('network error'))
  })

  await pageConfig.onShow()

  assert.equal(pageConfig.data.recentChapters[0].id, 'chapter-003')
})

test('home clears mock recent chapters when backend returns empty items', async () => {
  const { pageConfig } = loadPage({
    authToken: 'token-recent',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          items: [],
        },
      },
    })
  })

  await pageConfig.onShow()

  assert.deepEqual(pageConfig.data.recentChapters, [])
})

test('home recent chapters empty state copy exists', () => {
  const wxml = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8')

  assert.equal(wxml.includes('还没有漫画章节'), true)
  assert.equal(wxml.includes('写一篇日记，生成你的第一章漫画吧'), true)
})
