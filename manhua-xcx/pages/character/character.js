const { characterMock } = require('../../utils/mock')

Page({
  data: {
    mock: characterMock,
    nickname: characterMock.nickname,
    description: characterMock.description,
    personalityTags: characterMock.personalityTags,
    appearanceTags: characterMock.appearanceTags,
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

  togglePersonalityTag(event) {
    this.toggleTag('personalityTags', event.currentTarget.dataset.value)
  },

  toggleAppearanceTag(event) {
    this.toggleTag('appearanceTags', event.currentTarget.dataset.value)
  },

  toggleTag(key, value) {
    this.setData({
      [key]: this.data[key].map((tag) => ({
        ...tag,
        selected: tag.value === value ? !tag.selected : tag.selected,
      })),
    })
  },

  saveCharacter() {
    wx.showToast({
      title: '已本地保存占位',
      icon: 'none',
    })
  },
})
