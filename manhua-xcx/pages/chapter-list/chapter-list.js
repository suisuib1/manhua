const { pageRoutes } = require('../../utils/mock')
const { buildChapterList, buildReadableChapters } = require('../../utils/chapterCatalog')

Page({
  data: {
    chapters: [],
    hasChapters: false,
  },

  onLoad() {
    const chapters = buildReadableChapters()

    this.setData({
      chapters,
      hasChapters: chapters.length > 0,
    })
  },

  openChapter(event) {
    const { chapterId } = event.currentTarget.dataset

    if (!chapterId) return

    wx.navigateTo({
      url: `${pageRoutes.continuousChapter}?chapterId=${chapterId}`,
    })
  },

  goCreateChapter() {
    wx.switchTab({
      url: pageRoutes.create,
    })
  },
})

module.exports = {
  buildChapterList,
  buildReadableChapters,
}
