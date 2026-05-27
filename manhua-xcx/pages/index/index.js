const { homeMock, pageRoutes, chapterStatuses, storageKeys } = require('../../utils/mock')
const { getAuthToken, loginWithWechat } = require('../../utils/auth')
const { getRecentComicChapters } = require('../../utils/comicChapterApi')
const apiConfig = require('../../config/api.config')

const statusClassMap = {
  [chapterStatuses.completed]: 'is-completed',
  pending: 'is-generating',
  processing: 'is-generating',
  [chapterStatuses.generating]: 'is-generating',
  [chapterStatuses.failed]: 'is-failed',
}

const statusTextMap = {
  pending: '生成中',
  processing: '生成中',
  [chapterStatuses.generating]: '生成中',
  [chapterStatuses.completed]: '已完成',
  [chapterStatuses.failed]: '生成失败',
}

function formatRecentChapterDate(value) {
  if (!value) {
    return ''
  }

  const text = String(value)
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/)

  return isoDate ? isoDate[1] : text
}

function getRecentChapterStatusText(chapter) {
  return statusTextMap[chapter.status] || chapter.statusText || ''
}

function normalizeImageUrl(imageUrl) {
  if (!imageUrl || /^https?:\/\//.test(imageUrl) || /^wxfile:\/\//.test(imageUrl)) {
    return imageUrl || ''
  }

  return `${apiConfig.baseUrl}${imageUrl.indexOf('/') === 0 ? imageUrl : `/${imageUrl}`}`
}

function buildReaderChapterFromRecent(chapter) {
  const coverImageUrl = normalizeImageUrl(chapter && chapter.coverImageUrl)
  const id = chapter && (chapter.id || chapter.diaryEntryId || chapter.generationTaskId)
  const pageCount = Math.max(1, Number(chapter && chapter.pageCount ? chapter.pageCount : 1))
  const pages = coverImageUrl
    ? [{
      pageId: `${id || 'recent'}-page-1`,
      pageIndex: 0,
      images: [coverImageUrl],
      imageUrl: coverImageUrl,
      caption: chapter.summary || chapter.subtitle || '',
    }]
    : []

  return Object.assign({}, chapter, {
    id,
    diaryEntryId: chapter && chapter.diaryEntryId,
    generationTaskId: chapter && chapter.generationTaskId,
    title: chapter && chapter.title,
    date: (chapter && (chapter.date || chapter.createdAt || chapter.updatedAt)) || '',
    pageCount,
    coverImageUrl,
    imageUrl: coverImageUrl,
    images: coverImageUrl ? [coverImageUrl] : [],
    pages,
  })
}

function upsertReaderChapter(chapter) {
  if (!chapter || !chapter.id) {
    return
  }

  const chapters = wx.getStorageSync(storageKeys.generatedComicChapters) || []
  const readerChapter = buildReaderChapterFromRecent(chapter)
  if (!readerChapter.imageUrl) {
    return
  }

  const nextChapters = [readerChapter].concat(chapters.filter((item) => {
    return item.id !== readerChapter.id && item.diaryEntryId !== readerChapter.id
  }))

  wx.setStorageSync(storageKeys.generatedComicChapters, nextChapters)
}

function buildFallbackRecentChapters() {
  return homeMock.recentChapters.map((chapter) => Object.assign({}, chapter, {
    displayDate: formatRecentChapterDate(chapter.createdAt || chapter.date),
    displaySubtitle: chapter.summary || chapter.subtitle || '',
    statusClass: statusClassMap[chapter.status] || '',
    statusText: getRecentChapterStatusText(chapter),
  }))
}

function normalizeRecentChapter(chapter) {
  const pageCount = Number(chapter.pageCount || 0)
  const coverImageUrl = normalizeImageUrl(chapter.coverImageUrl || '')
  const readerChapter = buildReaderChapterFromRecent(Object.assign({}, chapter, {
    coverImageUrl,
  }))

  return Object.assign({}, chapter, {
    id: chapter.id || chapter.diaryEntryId || chapter.generationTaskId,
    subtitle: chapter.subtitle || chapter.title || '',
    coverImageUrl,
    imageUrl: readerChapter.imageUrl,
    images: readerChapter.images,
    pages: readerChapter.pages,
    displayDate: formatRecentChapterDate(chapter.createdAt || chapter.date),
    displaySubtitle: chapter.summary || chapter.subtitle || '',
    statusClass: statusClassMap[chapter.status] || '',
    statusText: getRecentChapterStatusText(chapter),
    pageCountText: pageCount > 0 ? `${pageCount} 页` : '',
  })
}

Page({
  isLoadingRecent: false,

  data: {
    user: homeMock.user,
    defaultComicBook: homeMock.defaultComicBook,
    freeQuotaRemaining: homeMock.freeQuotaRemaining,
    quotaHint: homeMock.quotaHint,
    recentChapters: buildFallbackRecentChapters(),
    isRecentChaptersEmpty: false,
    showLoginModal: false,
  },

  onLoad() {
    return null
  },

  onShow() {
    return this.loadRecentChapters()
  },

  async loadRecentChapters() {
    if (this.isLoadingRecent || !getAuthToken()) {
      return null
    }

    this.isLoadingRecent = true

    try {
      const data = await getRecentComicChapters({ limit: 5 })
      const items = data && Array.isArray(data.items) ? data.items : []

      this.setData({
        recentChapters: items.map(normalizeRecentChapter),
        isRecentChaptersEmpty: items.length === 0,
      })

      return data
    } catch (error) {
      return null
    } finally {
      this.isLoadingRecent = false
    }
  },

  requireLogin(nextAction) {
    if (getAuthToken()) {
      if (typeof nextAction === 'function') {
        nextAction()
      }
      return true
    }

    this.setData({
      showLoginModal: true,
    })
    return false
  },

  closeLoginModal() {
    this.setData({
      showLoginModal: false,
    })
  },

  async confirmLogin() {
    try {
      await loginWithWechat({})
      this.setData({
        showLoginModal: false,
      })
      await this.loadRecentChapters()
    } catch (error) {
      const title = error && error.statusCode === 0 && error.message
        ? error.message
        : '登录失败，请稍后重试'

      wx.showToast({
        title,
        icon: 'none',
      })
    }
  },

  goCreateChapter() {
    this.requireLogin(() => {
      wx.switchTab({
        url: pageRoutes.create,
      })
    })
  },

  goChapterDetail(event) {
    const { id } = event.currentTarget.dataset

    this.requireLogin(() => {
      const chapter = this.data.recentChapters.find((item) => item.id === id || item.diaryEntryId === id)
      upsertReaderChapter(chapter)

      wx.navigateTo({
        url: `${pageRoutes.continuousChapter}?chapterId=${id}`,
      })
    })
  },

  goCharacter() {
    this.requireLogin(() => {
      wx.navigateTo({
        url: pageRoutes.character,
      })
    })
  },

  goMine() {
    this.requireLogin(() => {
      wx.switchTab({
        url: pageRoutes.mine,
      })
    })
  },

})

module.exports = {
  buildFallbackRecentChapters,
  formatRecentChapterDate,
  normalizeRecentChapter,
  buildReaderChapterFromRecent,
  normalizeImageUrl,
}
