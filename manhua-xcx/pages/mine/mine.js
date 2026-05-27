const { mineMock, pageRoutes } = require('../../utils/mock')
const { clearAuthSession, getAuthToken, getCurrentUser, loginWithWechat, refreshCurrentUser } = require('../../utils/auth')

const loggedOutUser = {
  nickname: '未登录',
  subtitle: '点击登录同步你的漫画日记',
  avatar: '/subpackage/icon-home-mascot-star.png',
}

function buildMockWithUser(user) {
  return Object.assign({}, mineMock, {
    user: user && user.id
      ? {
        nickname: user.nickname || '漫画日记用户',
        subtitle: '私人漫画书同步中',
        avatar: user.avatarUrl || '/subpackage/icon-home-mascot-star.png',
      }
      : loggedOutUser,
  })
}

Page({
  data: {
    mock: buildMockWithUser(null),
  },

  onShow() {
    this.refreshUserProfile()
  },

  applyUser(user) {
    this.setData({
      mock: buildMockWithUser(user),
    })
  },

  async refreshUserProfile() {
    if (!getAuthToken()) {
      this.applyUser(null)
      return
    }

    this.applyUser(getCurrentUser())

    try {
      const { user } = await refreshCurrentUser()
      this.applyUser(user)
    } catch (error) {
      if (error && error.statusCode === 401) {
        clearAuthSession()
      }
      this.applyUser(null)
    }
  },

  async openComicBook() {
    if (!getAuthToken()) {
      await this.handleUserInfoTap()
      return
    }

    wx.navigateTo({
      url: pageRoutes.comicBook,
    })
  },

  async handleUserInfoTap() {
    if (getAuthToken()) {
      await this.refreshUserProfile()
      return
    }

    try {
      const user = await loginWithWechat({})
      this.applyUser(user)
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
