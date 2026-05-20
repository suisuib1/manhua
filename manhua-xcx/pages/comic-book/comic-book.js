const { comicBookMock, pageRoutes, homeMock } = require('../../utils/mock')
const { buildChapterList, loadStoredChapters } = require('../../utils/chapterCatalog')

const chapterListRoute = '/pages/chapter-list/chapter-list'

function mergeStoredChapters(defaultChapters, storedChapters) {
  return buildChapterList(defaultChapters, storedChapters)
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
      url: chapterListRoute,
    })
  },
})

module.exports = {
  getComicBookStats,
  mergeStoredChapters,
  loadStoredChapters,
}
