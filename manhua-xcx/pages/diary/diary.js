const { diaryMock, pageRoutes } = require('../../utils/mock')

Page({
  data: {
    mock: diaryMock,
    diaryText: '',
    textCount: 0,
    photoList: diaryMock.photoPlaceholders,
  },

  onDiaryInput(event) {
    const diaryText = event.detail.value

    this.setData({
      diaryText,
      textCount: diaryText.length,
    })
  },

  addPhotoPlaceholder() {
    const { photoList, mock } = this.data

    if (photoList.length >= mock.photoLimit) {
      wx.showToast({
        title: '最多记录 9 张照片',
        icon: 'none',
      })
      return
    }

    const nextIndex = photoList.length + 1

    this.setData({
      photoList: photoList.concat({
        id: `photo-${Date.now()}`,
        label: `照片 ${nextIndex}`,
        tone: nextIndex % 2 === 0 ? 'mint' : 'peach',
      }),
    })
  },

  removePhoto(event) {
    const { id } = event.currentTarget.dataset

    this.setData({
      photoList: this.data.photoList.filter((photo) => photo.id !== id),
    })
  },

  goGenerating() {
    wx.navigateTo({
      url: pageRoutes.generating,
    })
  },
})
