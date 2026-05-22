const { homeMock, pageRoutes, chapterStatuses } = require('../../utils/mock')

const statusClassMap = {
  [chapterStatuses.completed]: 'is-completed',
  [chapterStatuses.generating]: 'is-generating',
  [chapterStatuses.failed]: 'is-failed',
}

Page({
  data: {
    user: homeMock.user,
    defaultComicBook: homeMock.defaultComicBook,
    freeQuotaRemaining: homeMock.freeQuotaRemaining,
    quotaHint: homeMock.quotaHint,
    recentChapters: homeMock.recentChapters.map((chapter) => Object.assign({}, chapter, {
      statusClass: statusClassMap[chapter.status] || '',
    })),
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
