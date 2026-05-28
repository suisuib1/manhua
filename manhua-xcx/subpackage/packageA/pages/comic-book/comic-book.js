const { comicBookMock } = require('../../../../utils/mock')
const { getAuthToken } = require('../../../../utils/auth')
const { getRecentComicChapters } = require('../../../../utils/comicChapterApi')
const { buildChapterList, getChapterPageCount, loadStoredChapters, mergeRealAndLocalChapters } = require('../../../../utils/chapterCatalog')

const chapterListRoute = '/subpackage/packageA/pages/chapter-list/chapter-list'
const comicBookRecentLimit = 50

function mergeStoredChapters(defaultChapters, storedChapters) {
  return buildChapterList(defaultChapters, storedChapters)
}

function getComicBookStats(chapters) {
  const chapterCount = chapters.length
  const pageCount = chapters.reduce((total, chapter) => total + getChapterPageCount(chapter), 0)

  return {
    chapterCount,
    pageCount,
    updatedChapterText: `已更新到第 ${chapterCount} 章`,
    chapterText: `共 ${chapterCount} 章`,
    pageText: `共 ${pageCount} 页`,
  }
}

function buildComicBookMock(chapters) {
  return Object.assign({}, comicBookMock, {
    chapters,
    bookSummary: getComicBookStats(chapters),
  })
}

Page({
  data: {
    mock: buildComicBookMock([]),
  },

  async onLoad() {
    if (!getAuthToken()) {
      this.setData({
        mock: buildComicBookMock([]),
      })
      return null
    }

    try {
      const data = await getRecentComicChapters({ limit: comicBookRecentLimit })
      const realChapters = data && Array.isArray(data.items) ? data.items : []
      const chapters = mergeRealAndLocalChapters(realChapters, loadStoredChapters())

      this.setData({
        mock: buildComicBookMock(chapters),
      })

      return data
    } catch (error) {
      this.setData({
        mock: buildComicBookMock([]),
      })
      return null
    }
  },

  refreshBookFromChapters(chapters) {
    this.setData({
      mock: buildComicBookMock(chapters || []),
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
  buildComicBookMock,
  comicBookRecentLimit,
}
