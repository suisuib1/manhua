const { mineMock, pageRoutes } = require('../../utils/mock')

Page({
  data: {
    mock: mineMock,
  },

  openComicBook() {
    wx.navigateTo({
      url: pageRoutes.comicBook,
    })
  },

  handleUserInfoTap() {
    wx.showToast({
      title: '登录功能暂未开放',
      icon: 'none',
    })
  },

  handleMenuTap(event) {
    const { action, title } = event.currentTarget.dataset

    if (action === 'character') {
      wx.navigateTo({
        url: pageRoutes.character,
      })
      return
    }

    if (action === 'privacy' || action === 'about' || action === 'settings') {
      wx.navigateTo({
        url: pageRoutes[action],
      })
      return
    }

    wx.showToast({
      title: `${title}占位`,
      icon: 'none',
    })
  },

  goQuotaEmpty() {
    wx.navigateTo({
      url: pageRoutes.quotaEmpty,
    })
  },
})
