const { mineMock, pageRoutes } = require('../../utils/mock')
const { clearAuthSession, getAuthToken, getCurrentUser, loginWithWechat, refreshCurrentUser } = require('../../utils/auth')
const { getComicChapterStats } = require('../../utils/comicChapterApi')

const emptyBookStats = {
  chapterCount: 0,
  completedCount: 0,
  generatingCount: 0,
}

const loggedOutUser = {
  nickname: '未登录',
  subtitle: '点击登录同步你的漫画日记',
  avatar: '/subpackage/icon-home-mascot-star.png',
}

function buildMockWithUser(user) {
  return {
    user: user && user.id
      ? {
        nickname: user.nickname || '漫画日记用户',
        subtitle: '私人漫画书同步中',
        avatar: user.avatarUrl || '/subpackage/icon-home-mascot-star.png',
      }
      : loggedOutUser,
  }
}

function buildBookStats(stats) {
  return Object.assign({}, mineMock.bookStats, {
    chapterCount: Number(stats && stats.totalChapters) || 0,
    completedCount: Number(stats && stats.completedChapters) || 0,
    generatingCount: Number(stats && stats.generatingChapters) || 0,
  })
}

Page({
  data: {
    mock: Object.assign({}, mineMock, buildMockWithUser(null), {
      bookStats: buildBookStats(null),
    }),
  },

  onShow() {
    this.refreshUserProfile()
  },

  applyUser(user) {
    this.setData({
      mock: Object.assign({}, this.data.mock, buildMockWithUser(user)),
    })
  },

  applyBookStats(stats) {
    this.setData({
      mock: Object.assign({}, this.data.mock, {
        bookStats: buildBookStats(stats),
      }),
    })
  },

  async refreshUserProfile() {
    if (!getAuthToken()) {
      this.applyUser(null)
      this.applyBookStats(null)
      return
    }

    this.applyUser(getCurrentUser())
    this.refreshBookStats()

    try {
      const refreshed = await refreshCurrentUser()
      const user = refreshed && refreshed.user ? refreshed.user : refreshed
      this.applyUser(user)
    } catch (error) {
      if (error && error.statusCode === 401) {
        clearAuthSession()
      }
      this.applyUser(null)
      this.applyBookStats(null)
    }
  },

  async refreshBookStats() {
    if (!getAuthToken()) {
      this.applyBookStats(null)
      return null
    }

    try {
      const stats = await getComicChapterStats()
      this.applyBookStats(stats)
      return stats
    } catch (error) {
      console.warn('[mine] comic chapter stats load failed', error && error.message)
      return null
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
      await this.refreshBookStats()
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
