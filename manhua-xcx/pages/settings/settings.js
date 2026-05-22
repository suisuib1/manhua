const { storageKeys } = require('../../utils/mock')
const { request } = require('../../utils/api')
const { clearAuthSession, getAuthToken, getCurrentUser, loginWithWechat } = require('../../utils/auth')

const defaultSettings = {
  autoSaveDraft: true,
  keepPhotoMood: true,
  privateMode: true,
  diaryReminder: false,
  generationReminder: true,
}

const settingKeys = Object.keys(defaultSettings)

function cloneDefaultSettings() {
  return Object.assign({}, defaultSettings)
}

function readSettings() {
  return Object.assign(cloneDefaultSettings(), wx.getStorageSync(storageKeys.comicAppSettings) || {})
}

function saveSettings(settings) {
  wx.setStorageSync(storageKeys.comicAppSettings, Object.assign(cloneDefaultSettings(), settings))
}

function pickSettings(input) {
  return settingKeys.reduce((settings, key) => {
    if (input && Object.prototype.hasOwnProperty.call(input, key)) {
      settings[key] = input[key]
    }
    return settings
  }, {})
}

function buildUserState(user) {
  if (!user || !user.id) {
    return {
      nickname: '未登录',
      subtitle: '登录后同步你的漫画日记设置',
      avatar: '/subpackage/icon-home-mascot-star.png',
      loginText: '点击登录',
    }
  }

  return {
    nickname: user.nickname || '漫画日记用户',
    subtitle: '已登录，同步后端设置',
    avatar: user.avatarUrl || '/subpackage/icon-home-mascot-star.png',
    loginText: '已登录',
  }
}

Page({
  hasLoadedSettings: false,
  settingsLoadingPromise: null,

  data: {
    versionText: 'v1.0.0',
    user: buildUserState(null),
    settings: cloneDefaultSettings(),
  },

  onLoad() {
    return this.loadSettings()
  },

  onShow() {
    this.setData({
      user: buildUserState(getCurrentUser()),
    })

    if (!this.hasLoadedSettings) {
      return
    }

    return this.loadSettings()
  },

  async loadSettings() {
    this.setData({
      settings: readSettings(),
    })

    if (!getAuthToken()) {
      this.hasLoadedSettings = true
      return
    }

    if (this.settingsLoadingPromise) {
      return this.settingsLoadingPromise
    }

    this.settingsLoadingPromise = this.fetchBackendSettings()

    try {
      return await this.settingsLoadingPromise
    } finally {
      this.settingsLoadingPromise = null
      this.hasLoadedSettings = true
    }
  },

  async fetchBackendSettings() {
    try {
      const backendSettings = await request({
        url: '/api/users/me/settings',
        method: 'GET',
        auth: true,
      })
      const nextSettings = Object.assign(cloneDefaultSettings(), pickSettings(backendSettings))
      this.setData({
        settings: nextSettings,
      })
      saveSettings(nextSettings)
    } catch (error) {
      if (error && error.statusCode === 401) {
        clearAuthSession()
        this.setData({
          user: buildUserState(null),
        })
      }
    }
  },

  syncSettings(patch) {
    const nextSettings = Object.assign({}, this.data.settings, patch)
    this.setData({
      settings: nextSettings,
    })
    saveSettings(nextSettings)
  },

  async saveSettingsPatch(patch) {
    const safePatch = pickSettings(patch)

    if (!getAuthToken()) {
      this.syncSettings(safePatch)
      return this.data.settings
    }

    const backendSettings = await request({
      url: '/api/users/me/settings',
      method: 'PUT',
      data: safePatch,
      auth: true,
    })
    const nextSettings = Object.assign(cloneDefaultSettings(), pickSettings(backendSettings))
    this.setData({
      settings: nextSettings,
    })
    saveSettings(nextSettings)
    return nextSettings
  },

  async handleAccountTap() {
    if (getAuthToken()) {
      return
    }

    try {
      const user = await loginWithWechat({})
      this.setData({
        user: buildUserState(user),
      })
      await this.loadSettings()
    } catch (error) {
      wx.showToast({
        title: '登录失败，请稍后重试',
        icon: 'none',
      })
    }
  },

  openProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    })
  },

  handleStyleTap() {
    wx.showToast({
      title: '当前默认 Q 版温暖漫画',
      icon: 'none',
    })
  },

  async handleToggleChange(event) {
    const { key } = event.currentTarget.dataset

    if (!Object.prototype.hasOwnProperty.call(defaultSettings, key)) {
      return
    }

    const previousSettings = Object.assign({}, this.data.settings)

    try {
      await this.saveSettingsPatch({
        [key]: event.detail.value,
      })
    } catch (error) {
      this.setData({
        settings: previousSettings,
      })
      saveSettings(previousSettings)

      if (error && error.statusCode === 401) {
        clearAuthSession()
        this.setData({
          user: buildUserState(null),
        })
      }

      wx.showToast({
        title: '保存失败',
        icon: 'none',
      })
    }
  },

  confirmAndClearStorage(storageKey, successTitle) {
    wx.showModal({
      title: '确认清理',
      content: '清理后无法恢复，请确认只删除本次选择的数据。',
      confirmText: '清理',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        wx.removeStorageSync(storageKey)
        wx.showToast({
          title: successTitle,
          icon: 'none',
        })
      },
    })
  },

  clearDraftCache() {
    this.confirmAndClearStorage(storageKeys.draftComicChapter, '已清理')
  },

  clearGeneratedCache() {
    this.confirmAndClearStorage(storageKeys.generatedComicChapters, '已清理')
  },

  handleHelpTap(event) {
    const { action } = event.currentTarget.dataset

    if (action === 'version') {
      wx.showToast({
        title: `当前版本 ${this.data.versionText}`,
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: '功能后续接入',
      icon: 'none',
    })
  },

  handleLogoutTap() {
    clearAuthSession()
    this.setData({
      user: buildUserState(null),
    })
    wx.showToast({
      title: '已退出登录',
      icon: 'none',
    })
  },
})
