const { generatingMock, pageRoutes } = require('../../utils/mock')

Page({
  timer: null,

  data: {
    mock: generatingMock,
    progress: generatingMock.progressStart,
    activeStepIndex: 0,
    canViewChapter: false,
  },

  onLoad() {
    this.startMockProgress()
  },

  onUnload() {
    this.clearMockTimer()
  },

  startMockProgress() {
    this.clearMockTimer()

    this.timer = setInterval(() => {
      const nextProgress = Math.min(this.data.progress + 9, 100)
      const activeStepIndex = Math.min(
        Math.floor((nextProgress / 100) * this.data.mock.steps.length),
        this.data.mock.steps.length - 1
      )

      this.setData({
        progress: nextProgress,
        activeStepIndex,
        canViewChapter: nextProgress >= 100,
      })

      if (nextProgress >= 100) {
        this.clearMockTimer()
      }
    }, 800)
  },

  clearMockTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  goChapterDetail() {
    wx.navigateTo({
      url: pageRoutes.chapterDetail,
    })
  },

  retryTask() {
    wx.showToast({
      title: '当前为失败重试占位',
      icon: 'none',
    })
  },
})
