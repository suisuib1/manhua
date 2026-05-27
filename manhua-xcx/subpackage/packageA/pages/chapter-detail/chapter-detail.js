const { chapterDetailMock, pageRoutes } = require('../../../../utils/mock')

Page({
  data: {
    mock: chapterDetailMock,
  },

  goShare() {
    wx.navigateTo({
      url: pageRoutes.share,
    })
  },

  regenerateChapter() {
    wx.showToast({
      title: '重新生成入口占位',
      icon: 'none',
    })
  },

  confirmDelete() {
    wx.showModal({
      title: '删除章节占位',
      content: '当前为静态页面，不会删除真实数据。',
      confirmText: '知道了',
      showCancel: false,
    })
  },
})
