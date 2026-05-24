const { homeMock, pageRoutes, chapterStatuses } = require('../../utils/mock')
const { getAuthToken } = require('../../utils/auth')
const { getRecentComicChapters } = require('../../utils/comicChapterApi')

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

  return Object.assign({}, chapter, {
    id: chapter.id || chapter.diaryEntryId || chapter.generationTaskId,
    subtitle: chapter.subtitle || chapter.title || '',
    coverImageUrl: chapter.coverImageUrl || '',
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

      if (items.length > 0) {
        this.setData({
          recentChapters: items.map(normalizeRecentChapter),
        })
      }

      return data
    } catch (error) {
      return null
    } finally {
      this.isLoadingRecent = false
    }
  },

  goCreateChapter() {
    wx.switchTab({
      url: pageRoutes.create,
    })
  },

  goChapterDetail(event) {
    const { id } = event.currentTarget.dataset

    wx.navigateTo({
      url: `${pageRoutes.continuousChapter}?chapterId=${id}`,
    })
  },

  goCharacter() {
    wx.navigateTo({
      url: pageRoutes.character,
    })
  },

  goMine() {
    wx.switchTab({
      url: pageRoutes.mine,
    })
  },

})

module.exports = {
  buildFallbackRecentChapters,
  formatRecentChapterDate,
  normalizeRecentChapter,
}
