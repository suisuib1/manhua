const { characterMock } = require('../../utils/mock')

Page({
  data: {
    mock: characterMock,
    nickname: characterMock.nickname,
    description: characterMock.description,
    personalityText: characterMock.personalityTags.map((tag) => tag.label).join('、'),
    appearanceText: characterMock.appearanceTags.map((tag) => tag.label).join('、'),
    referenceImage: '/subpackage/icon-home-mascot-star.png',
  },

  onNicknameInput(event) {
    this.setData({
      nickname: event.detail.value,
    })
  },

  onDescriptionInput(event) {
    this.setData({
      description: event.detail.value,
    })
  },

  onPersonalityInput(event) {
    this.setData({
      personalityText: event.detail.value,
    })
  },

  onAppearanceInput(event) {
    this.setData({
      appearanceText: event.detail.value,
    })
  },

  chooseReferenceImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const firstFile = res.tempFiles && res.tempFiles[0]
        if (!firstFile) {
          return
        }

        this.setData({
          referenceImage: firstFile.tempFilePath,
        })
      },
    })
  },

  saveCharacter() {
    wx.showToast({
      title: '已本地保存占位',
      icon: 'none',
    })
  },
})
