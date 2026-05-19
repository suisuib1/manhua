const { comicBookMock, pageRoutes, storageKeys, homeMock } = require('../../utils/mock')

function loadStoredChapters() {
  return wx.getStorageSync(storageKeys.generatedComicChapters) || []
}

function mergeStoredChapters(defaultChapters, storedChapters) {
  return defaultChapters.concat(storedChapters)
}

function getComicBookStats(chapters) {
  const chapterCount = chapters.length
  const pageCount = chapters.reduce((total, chapter) => total + chapter.pages.length, 0)

  return {
    chapterCount,
    pageCount,
    updatedChapterText: `已更新到第 ${chapterCount} 章`,
    chapterText: `共 ${chapterCount} 章`,
    pageText: `共 ${pageCount} 页`,
  }
}

Page({
  data: {
    mock: Object.assign({}, comicBookMock, {
      chapters: mergeStoredChapters(homeMock.recentChapters, loadStoredChapters()),
    }),
  },

  onLoad() {
    const chapters = mergeStoredChapters(homeMock.recentChapters, loadStoredChapters())
    this.setData({
      mock: Object.assign({}, comicBookMock, {
        chapters,
        bookSummary: getComicBookStats(chapters),
      }),
    })
  },

  openComic() {
    wx.navigateTo({
      url: `${pageRoutes.continuousChapter}?comicId=${comicBookMock.comics[0].id}`,
    })
  },
})

module.exports = {
  getComicBookStats,
  mergeStoredChapters,
  loadStoredChapters,
}
