const { diaryMock, pageRoutes } = require('../../../../utils/mock')
const { getAuthToken } = require('../../../../utils/auth')
const { getCharacterProfile } = require('../../../../utils/characterProfileApi')
const { saveDraftWithBackendFallback } = require('../../../../utils/diarySync')

const localCharacterProfileKey = 'characterProfile'

function decodeDraft(query) {
  if (!query) return null

  try {
    return JSON.parse(decodeURIComponent(query))
  } catch (err) {
    return null
  }
}

function hasValidCharacterProfile(profile) {
  if (!profile) {
    return false
  }

  return [
    profile.nickname,
    profile.description,
    profile.personalityText,
    profile.appearanceText,
    profile.referenceImageUrl,
  ].some((value) => String(value || '').trim())
}

function getLocalCharacterProfile() {
  return wx.getStorageSync(localCharacterProfileKey) || null
}

function setLocalCharacterProfile(profile) {
  wx.setStorageSync(localCharacterProfileKey, profile)
}

function buildPendingDraft(baseDraft, diaryText, photoItem) {
  return {
    chapterTitle: baseDraft && baseDraft.chapterTitle ? baseDraft.chapterTitle : diaryMock.chapterSummary.title,
    diaryDate: baseDraft && baseDraft.diaryDate ? baseDraft.diaryDate : diaryMock.chapterSummary.dateLabel.slice(0, 10),
    pageCount: baseDraft && baseDraft.pageCount ? baseDraft.pageCount : 1,
    pageMode: baseDraft && baseDraft.pageMode ? baseDraft.pageMode : 'custom',
    selectedTags: baseDraft && baseDraft.selectedTags ? baseDraft.selectedTags : diaryMock.chapterSummary.tags,
    diaryText,
    photoPath: photoItem ? photoItem.path : '',
  }
}

Page({
  data: {
    mock: diaryMock,
    diaryText: '',
    textCount: 0,
    photoLimit: 1,
    photoItem: null,
    createDraft: null,
    characterProfile: null,
    hasCharacterProfile: false,
    hasCharacterProfileLoaded: false,
  },

  onLoad(options) {
    const createDraft = decodeDraft(options && options.draft)

    this.setData({
      createDraft,
    })
  },

  onShow() {
    return this.refreshCharacterProfile()
  },

  async refreshCharacterProfile() {
    if (!getAuthToken()) {
      const localProfile = getLocalCharacterProfile()
      const hasCharacterProfile = hasValidCharacterProfile(localProfile)

      this.setData({
        characterProfile: hasCharacterProfile ? localProfile : null,
        hasCharacterProfile,
        hasCharacterProfileLoaded: true,
      })
      return hasCharacterProfile ? localProfile : null
    }

    try {
      const profile = await getCharacterProfile()
      const hasCharacterProfile = hasValidCharacterProfile(profile)

      if (hasCharacterProfile) {
        setLocalCharacterProfile(profile)
      }

      this.setData({
        characterProfile: hasCharacterProfile ? profile : null,
        hasCharacterProfile,
        hasCharacterProfileLoaded: true,
      })
      return hasCharacterProfile ? profile : null
    } catch (error) {
      const localProfile = getLocalCharacterProfile()
      const hasCharacterProfile = hasValidCharacterProfile(localProfile)

      this.setData({
        characterProfile: hasCharacterProfile ? localProfile : null,
        hasCharacterProfile,
        hasCharacterProfileLoaded: true,
      })
      return hasCharacterProfile ? localProfile : null
    }
  },

  onDiaryInput(event) {
    const diaryText = event.detail.value

    this.setData({
      diaryText,
      textCount: diaryText.length,
    })
  },

  addPhotoPlaceholder() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          photoItem: {
            id: `photo-${Date.now()}`,
            path: res.tempFilePaths[0],
          },
        })
      },
      fail: () => {
        wx.showToast({
          title: '未选择照片',
          icon: 'none',
        })
      },
    })
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
    })
  },

  goGenerating() {
    if (!String(this.data.diaryText || '').trim()) {
      wx.showToast({
        title: '请先填写日记内容',
        icon: 'none',
      })
      return
    }

    const localProfile = this.data.hasCharacterProfileLoaded ? null : getLocalCharacterProfile()
    const currentProfile = this.data.hasCharacterProfile ? this.data.characterProfile : localProfile

    if (hasValidCharacterProfile(currentProfile)) {
      this.continueGenerating()
      return
    }

    wx.showModal({
      title: '完善主角设定',
      content: '设置主角昵称、性格和外观后，生成的漫画会更像你。',
      confirmText: '去设置',
      cancelText: '跳过',
      success: (res) => {
        if (res && res.confirm) {
          wx.navigateTo({
            url: `${pageRoutes.character}?from=diary`,
          })
          return
        }

        if (res && res.cancel) {
          this.continueGenerating()
        }
      },
      fail: () => {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
        })
      },
    })
  },

  continueGenerating() {
    const draft = buildPendingDraft(this.data.createDraft, this.data.diaryText, this.data.photoItem)
    saveDraftWithBackendFallback(draft, {
      showFailToast: true,
    })
    wx.navigateTo({
      url: pageRoutes.generating,
      fail: () => {
        wx.showToast({
          title: '生成页打开失败，请稍后重试',
          icon: 'none',
        })
      },
    })
  },
})

module.exports = {
  buildPendingDraft,
  decodeDraft,
  hasValidCharacterProfile,
}
