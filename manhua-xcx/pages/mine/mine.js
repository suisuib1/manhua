const { mineMock, pageRoutes } = require('../../utils/mock')

Page({
  data: {
    mock: mineMock,
  },

  handleMenuTap(event) {
    const { action, title } = event.currentTarget.dataset

    if (action === 'character') {
      wx.navigateTo({
        url: pageRoutes.character,
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
