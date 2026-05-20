const { continuousChapterMock, storageKeys, pageRoutes, homeMock } = require('../../utils/mock')

function loadStoredChapters() {
  return wx.getStorageSync(storageKeys.generatedComicChapters) || []
}

function mergeStoredChapters(defaultChapters, storedChapters) {
  return defaultChapters.concat(storedChapters)
}

function pickImageUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return item

  return item.imageUrl || item.url || item.src || item.path || item.tempFilePath || ''
}

function collectImageUrls(items) {
  if (!Array.isArray(items)) return []

  return items.map(pickImageUrl).filter(Boolean)
}

function getChapterImages(chapter) {
  if (!chapter) return []

  const imageFields = ['images', 'comicImages', 'pageImages', 'panels']
  const images = imageFields.reduce((result, field) => {
    return result.concat(collectImageUrls(chapter[field]))
  }, [])

  if (Array.isArray(chapter.pages)) {
    chapter.pages.forEach((page) => {
      images.push(...getChapterImages(page))
    })
  }

  ;['imageUrl', 'coverImage', 'generatedImage'].forEach((field) => {
    const image = pickImageUrl(chapter[field])
    if (image) images.push(image)
  })

  return images
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
      chapter.pages.forEach((page, pageIndex) => {
        pages.push(buildPageFromPage(chapter, chapterIndex, page, pageIndex, chapter.pages.length))
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
    hasComicImages: Boolean(flatPages[0] && flatPages[0].image),
  },

  touchStartX: 0,

  onLoad(options) {
    const startIndex = findInitialPageIndex(flatPages, options && options.chapterId)

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
  buildReaderState,
  getChapterImages,
  findInitialPageIndex,
  mergeStoredChapters,
  buildReaderChapters,
}
