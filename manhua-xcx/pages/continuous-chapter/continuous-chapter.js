const { continuousChapterMock, storageKeys, pageRoutes, homeMock } = require('../../utils/mock')

function loadStoredChapters() {
  return wx.getStorageSync(storageKeys.generatedComicChapters) || []
}

function mergeStoredChapters(defaultChapters, storedChapters) {
  return defaultChapters.concat(storedChapters)
}

function buildFlatPages(chapters) {
  return chapters.reduce((pages, chapter, chapterIndex) => {
    const chapterNo = chapterIndex + 1

    chapter.pages.forEach((page, pageIndex) => {
      pages.push({
        pageId: page.pageId,
        chapterId: chapter.id,
        chapterIndex,
        chapterNo,
        chapterTitle: chapter.subtitle || chapter.title,
        chapterLabel: chapter.title,
        pageIndex,
        pageNo: pageIndex + 1,
        images: page.images,
        caption: page.caption,
        date: chapter.date,
        totalChapterPages: chapter.pages.length,
      })
    })

    return pages
  }, [])
}

function buildReaderState(currentIndex, flatPages) {
  const currentPage = flatPages[currentIndex]

  return {
    currentIndex,
    currentPage,
    progressText: `第 ${currentPage.chapterNo} 章 · 第 ${currentPage.pageNo} 页 / 共 ${flatPages.length} 页`,
    chapterToast: `第 ${currentPage.chapterNo} 章：${currentPage.chapterTitle}`,
    isLastPage: currentIndex === flatPages.length - 1,
  }
}

function buildReaderChapters() {
  return mergeStoredChapters(homeMock.recentChapters.slice().reverse(), loadStoredChapters())
}

const readerChapters = buildReaderChapters()
const flatPages = buildFlatPages(readerChapters)

Page({
  data: {
    mock: continuousChapterMock,
    flatPages,
    totalPages: flatPages.length,
    currentIndex: 0,
    currentPage: flatPages[0],
    progressText: '',
    chapterToast: '',
    isLastPage: false,
  },

  onLoad(options) {
    const startIndex = options && options.chapterId
      ? Math.max(flatPages.findIndex((page) => page.chapterId === options.chapterId), 0)
      : 0

    this.setData(buildReaderState(startIndex, flatPages))
  },

  goBackToComicList() {
    wx.navigateBack({
      delta: 1,
    })
  },

  handlePageChange(event) {
    const currentIndex = event.detail.current

    this.setData(buildReaderState(currentIndex, this.data.flatPages))
  },

  backToCover() {
    wx.navigateBack({
      delta: 1,
    })
  },
})

module.exports = {
  buildFlatPages,
  buildReaderState,
  mergeStoredChapters,
  buildReaderChapters,
}
