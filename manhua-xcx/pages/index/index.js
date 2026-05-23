const { homeMock, pageRoutes, chapterStatuses } = require('../../utils/mock')
const { getAuthToken } = require('../../utils/auth')
const { getRecentComicChapters } = require('../../utils/comicChapterApi')

const statusClassMap = {
  [chapterStatuses.completed]: 'is-completed',
  [chapterStatuses.generating]: 'is-generating',
  [chapterStatuses.failed]: 'is-failed',
}

function buildFallbackRecentChapters() {
  return homeMock.recentChapters.map((chapter) => Object.assign({}, chapter, {
    statusClass: statusClassMap[chapter.status] || '',
  }))
}

function normalizeRecentChapter(chapter) {
  const pageCount = Number(chapter.pageCount || 0)

  return Object.assign({}, chapter, {
    id: chapter.id || chapter.diaryEntryId || chapter.generationTaskId,
    subtitle: chapter.subtitle || chapter.title || '',
    coverImageUrl: chapter.coverImageUrl || '',
    statusClass: statusClassMap[chapter.status] || '',
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
  normalizeRecentChapter,
}
