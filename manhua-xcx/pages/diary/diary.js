const { diaryMock, pageRoutes } = require('../../utils/mock')
const { saveDraftWithBackendFallback } = require('../../utils/diarySync')

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
  return Boolean(
    profile &&
    String(profile.nickname || '').trim() &&
    String(profile.personalityText || '').trim() &&
    String(profile.appearanceText || '').trim()
  )
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
  },

  onLoad(options) {
    const createDraft = decodeDraft(options && options.draft)

    this.setData({
      createDraft,
    })
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
    const localProfile = wx.getStorageSync(localCharacterProfileKey)

    if (hasValidCharacterProfile(localProfile)) {
      this.continueGenerating()
      return
    }

    wx.showModal({
      title: '完善主角设定',
      content: '设置主角昵称、性格和外观后，生成的漫画会更像你。',
      confirmText: '去设置',
      cancelText: '跳过，使用默认主角',
      success: (res) => {
        if (res && res.confirm) {
          wx.navigateTo({
            url: pageRoutes.character,
          })
          return
        }

        if (res && res.cancel) {
          this.continueGenerating()
        }
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
    })
  },
})

module.exports = {
  buildPendingDraft,
  decodeDraft,
  hasValidCharacterProfile,
}
