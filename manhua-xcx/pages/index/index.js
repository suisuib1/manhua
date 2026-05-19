const { homeMock, pageRoutes, chapterStatuses } = require('../../utils/mock')

const statusClassMap = {
  [chapterStatuses.completed]: 'is-completed',
  [chapterStatuses.generating]: 'is-generating',
  [chapterStatuses.failed]: 'is-failed',
}

Page({
  data: {
    navBarHeight: 88,
    navTitleTop: 44,
    navTitleHeight: 32,
    user: homeMock.user,
    defaultComicBook: homeMock.defaultComicBook,
    freeQuotaRemaining: homeMock.freeQuotaRemaining,
    quotaHint: homeMock.quotaHint,
    recentChapters: homeMock.recentChapters.map((chapter) => Object.assign({}, chapter, {
      statusClass: statusClassMap[chapter.status] || '',
    })),
  },

  onLoad() {
    this.setData({
      ...this.getNavBarMetrics(),
    })
  },

  getNavBarMetrics() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = windowInfo.statusBarHeight || 20

    if (!menuButton || !menuButton.top || !menuButton.bottom) {
      return {
        navBarHeight: statusBarHeight + 44,
        navTitleTop: statusBarHeight,
        navTitleHeight: 44,
      }
    }

    return {
      navBarHeight: menuButton.bottom + (menuButton.top - statusBarHeight),
      navTitleTop: menuButton.top,
      navTitleHeight: menuButton.height,
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
