const { quotaEmptyMock, pageRoutes } = require('../../utils/mock')

Page({
  data: {
    mock: quotaEmptyMock,
  },

  goHome() {
    wx.switchTab({
      url: pageRoutes.home,
    })
  },

  viewChapter() {
    wx.navigateTo({
      url: pageRoutes.chapterDetail,
    })
  },
})
