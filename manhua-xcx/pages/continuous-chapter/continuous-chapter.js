const { continuousChapterMock, pageRoutes } = require('../../utils/mock')
const { buildReadableChapters, collectImageUrls, getChapterImages, normalizeChapter } = require('../../utils/chapterCatalog')

function getPageSortValue(page, fallbackIndex) {
  const value = [page && page.sortOrder, page && page.pageIndex, page && page.index]
    .find((item) => item !== undefined && item !== null && item !== '')
  const numericValue = Number(value)

  return Number.isNaN(numericValue) ? fallbackIndex : numericValue
}

function sortChapterPages(pages) {
  return pages
    .map((page, originalIndex) => ({ page, originalIndex }))
    .sort((a, b) => {
      const sortDiff = getPageSortValue(a.page, a.originalIndex) - getPageSortValue(b.page, b.originalIndex)

      return sortDiff || a.originalIndex - b.originalIndex
    })
    .map((entry) => entry.page)
}

function buildPageFromChapterImage(chapter, chapterIndex, image, pageIndex, totalPages) {
  const chapterNo = chapterIndex + 1

  return {
    pageId: `${chapter.id || `chapter-${chapterNo}`}-image-${pageIndex + 1}`,
    chapterId: chapter.id,
    chapterIndex,
    chapterNo,
    chapterTitle: chapter.subtitle || chapter.title || '',
    chapterLabel: chapter.title || '',
    pageIndex,
    pageNo: pageIndex + 1,
    image,
    caption: chapter.caption || chapter.summary || '',
    date: chapter.date || '',
    totalChapterPages: totalPages,
    pageText: `第 ${pageIndex + 1} / ${totalPages} 页`,
  }
}

function buildPageFromPage(chapter, chapterIndex, page, pageIndex, totalPages) {
  const chapterNo = chapterIndex + 1
  const pageImages = getChapterImages(page)

  return {
    pageId: page.pageId || `${chapter.id || `chapter-${chapterNo}`}-page-${pageIndex + 1}`,
    chapterId: chapter.id,
    chapterIndex,
    chapterNo,
    chapterTitle: chapter.subtitle || chapter.title || '',
    chapterLabel: chapter.title || '',
    pageIndex,
    pageNo: pageIndex + 1,
    image: pageImages[0] || '',
    caption: page.caption || chapter.caption || chapter.summary || '',
    date: chapter.date || '',
    totalChapterPages: totalPages,
    pageText: `第 ${pageIndex + 1} / ${totalPages} 页`,
  }
}

function buildFlatPages(chapters) {
  return chapters.reduce((pages, chapter, chapterIndex) => {
    if (Array.isArray(chapter.pages) && chapter.pages.length > 0) {
      const sortedPages = sortChapterPages(chapter.pages)

      sortedPages.forEach((page, pageIndex) => {
        pages.push(buildPageFromPage(chapter, chapterIndex, page, pageIndex, sortedPages.length))
      })
      return pages
    }

    const chapterImages = getChapterImages(chapter)
    chapterImages.forEach((image, pageIndex) => {
      pages.push(buildPageFromChapterImage(chapter, chapterIndex, image, pageIndex, chapterImages.length))
    })

    return pages
  }, [])
}

function findChapterForReader(chapters, chapterId) {
  const sortedChapters = chapters.slice().sort((a, b) => {
    if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime
    return a.sourceIndex - b.sourceIndex
  })

  if (chapterId) {
    const chapter = sortedChapters.find((item) => item.id === chapterId || item.chapterId === chapterId)

    if (chapter) return chapter
  }

  return sortedChapters[0] || null
}

function buildPagesForReader(chapters, chapterId) {
  const readableChapters = chapters.map((chapter, index) => {
    return chapter.sortTime === undefined ? normalizeChapter(chapter, index) : chapter
  })
  const chapter = findChapterForReader(readableChapters, chapterId)

  return chapter ? buildFlatPages([chapter]) : []
}

function buildReaderState(currentIndex, flatPages) {
  if (flatPages.length === 0) {
    return {
      currentIndex: 0,
      currentPage: null,
      progressText: '',
      chapterToast: '',
      isLastPage: true,
      hasComicImages: false,
    }
  }

  const safeIndex = Math.max(0, Math.min(currentIndex, flatPages.length - 1))
  const currentPage = flatPages[safeIndex]

  return {
    currentIndex: safeIndex,
    currentPage,
    progressText: `第 ${safeIndex + 1} / ${flatPages.length} 页`,
    chapterToast: `第 ${currentPage.chapterNo} 章：${currentPage.chapterTitle}`,
    isLastPage: safeIndex === flatPages.length - 1,
    hasComicImages: Boolean(currentPage.image),
  }
}

function findInitialPageIndex(flatPages, chapterId) {
  if (!chapterId) return 0

  const pageIndex = flatPages.findIndex((page) => page.chapterId === chapterId)

  return pageIndex === -1 ? 0 : pageIndex
}

function buildReaderChapters() {
  return buildReadableChapters()
}

const readerChapters = buildReaderChapters()
const flatPages = buildPagesForReader(readerChapters)

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
    hasComicImages: Boolean(flatPages[0] && flatPages[0].image),
  },

  touchStartX: 0,

  onLoad(options) {
    const chapters = buildReaderChapters()
    const pages = buildPagesForReader(chapters, options && options.chapterId)

    this.setData(Object.assign({
      flatPages: pages,
      totalPages: pages.length,
    }, buildReaderState(0, pages)))
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

  handleTouchStart(event) {
    const touch = event.changedTouches && event.changedTouches[0]

    if (!touch) return

    this.touchStartX = touch.clientX
  },

  handleTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0]

    if (!touch) return

    const deltaX = touch.clientX - this.touchStartX
    const threshold = 40

    if (deltaX > threshold) {
      this.goNextPage()
      return
    }

    if (deltaX < -threshold) {
      this.goPreviousPage()
    }
  },

  goNextPage() {
    const nextIndex = this.data.currentIndex + 1

    if (nextIndex >= this.data.flatPages.length) {
      wx.showToast({
        title: '已经是最后一页',
        icon: 'none',
      })
      return
    }

    this.setData(buildReaderState(nextIndex, this.data.flatPages))
  },

  goPreviousPage() {
    const previousIndex = this.data.currentIndex - 1

    if (previousIndex < 0) {
      wx.showToast({
        title: '已经是第一页',
        icon: 'none',
      })
      return
    }

    this.setData(buildReaderState(previousIndex, this.data.flatPages))
  },

  backToCover() {
    wx.redirectTo({
      url: pageRoutes.comicBook,
    })
  },
})

module.exports = {
  buildFlatPages,
  buildPagesForReader,
  buildReaderState,
  getChapterImages,
  findInitialPageIndex,
  buildReaderChapters,
  sortChapterPages,
}
