const { shareMock, pageRoutes } = require('../../utils/mock')

Page({
  data: {
    mock: shareMock,
  },

  copyLink() {
    wx.showToast({
      title: '复制链接占位',
      icon: 'none',
    })
  },

  shareToWechat() {
    wx.showToast({
      title: '微信分享占位',
      icon: 'none',
    })
  },

  goHome() {
    wx.switchTab({
      url: pageRoutes.home,
    })
  },
})
