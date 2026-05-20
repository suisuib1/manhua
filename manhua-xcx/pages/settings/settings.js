const { storageKeys } = require('../../utils/mock')

const defaultSettings = {
  autoSaveDraft: true,
  keepPhotoMood: true,
  privateMode: true,
  diaryReminder: false,
  generationReminder: true,
}

function cloneDefaultSettings() {
  return Object.assign({}, defaultSettings)
}

function readSettings() {
  return Object.assign(cloneDefaultSettings(), wx.getStorageSync(storageKeys.comicAppSettings) || {})
}

function saveSettings(settings) {
  wx.setStorageSync(storageKeys.comicAppSettings, Object.assign(cloneDefaultSettings(), settings))
}

Page({
  data: {
    versionText: 'v1.0.0',
    user: {
      nickname: '未登录',
      subtitle: '登录后同步你的漫画日记设置',
      avatar: '/subpackage/icon-home-mascot-star.png',
      loginText: '点击登录',
    },
    settings: cloneDefaultSettings(),
  },

  onLoad() {
    this.setData({
      settings: readSettings(),
    })
  },

  syncSettings(patch) {
    const nextSettings = Object.assign({}, this.data.settings, patch)
    this.setData({
      settings: nextSettings,
    })
    saveSettings(nextSettings)
  },

  handleAccountTap() {
    wx.showToast({
      title: '登录功能开发中',
      icon: 'none',
    })
  },

  handleStyleTap() {
    wx.showToast({
      title: '当前默认 Q 版温暖漫画',
      icon: 'none',
    })
  },

  handleToggleChange(event) {
    const { key } = event.currentTarget.dataset
    this.syncSettings({
      [key]: event.detail.value,
    })
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
    wx.showToast({
      title: '当前未登录',
      icon: 'none',
    })
  },
})
