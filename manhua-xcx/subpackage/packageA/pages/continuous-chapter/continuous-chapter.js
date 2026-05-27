const { continuousChapterMock, pageRoutes, storageKeys } = require('../../../../utils/mock')
const { buildReadableChapters, collectImageUrls, getChapterImages, normalizeChapter } = require('../../../../utils/chapterCatalog')
const { getGenerationTask } = require('../../../../utils/generationTaskApi')
const apiConfig = require('../../../../config/api.config')

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

function normalizeGeneratedImageUrl(imageUrl) {
  if (!imageUrl || /^https?:\/\//.test(imageUrl) || /^wxfile:\/\//.test(imageUrl)) {
    return imageUrl || ''
  }

  return `${apiConfig.baseUrl}${imageUrl.indexOf('/') === 0 ? imageUrl : `/${imageUrl}`}`
}

function getFirstGenerationImageUrl(task) {
  const pages = task && task.result && Array.isArray(task.result.pages) ? task.result.pages : []
  const firstPage = pages.find((page) => page && page.imageUrl)

  return firstPage ? normalizeGeneratedImageUrl(firstPage.imageUrl) : ''
}

function isGeneratedImageUrl(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.indexOf('/uploads/generated/') !== -1
}

function findGeneratedImageUrl(chapter) {
  return getChapterImages(chapter).find(isGeneratedImageUrl) || ''
}

function injectGeneratedImage(chapter, imageUrl) {
  if (!chapter || !imageUrl) {
    return chapter
  }

  const pages = Array.isArray(chapter.pages) ? chapter.pages.slice() : []
  const firstPage = Object.assign({}, pages[0] || {})
  firstPage.images = [imageUrl]
  firstPage.imageUrl = imageUrl
  pages[0] = firstPage

  return Object.assign({}, chapter, {
    images: [imageUrl],
    coverImageUrl: imageUrl,
    imageUrl,
    pages,
  })
}

function replaceStoredGeneratedChapter(updatedChapter) {
  const chapters = wx.getStorageSync(storageKeys.generatedComicChapters) || []
  const nextChapters = chapters.map((chapter) => {
    const sameChapter = chapter.id === updatedChapter.id || chapter.chapterId === updatedChapter.id

    return sameChapter ? Object.assign({}, chapter, updatedChapter) : chapter
  })

  wx.setStorageSync(storageKeys.generatedComicChapters, nextChapters)
}

async function healGeneratedChapterImage(pageContext, chapter) {
  if (!pageContext || !chapter) {
    return
  }

  try {
    const existingImageUrl = findGeneratedImageUrl(chapter)

    if (existingImageUrl) {
      const normalizedImageUrl = normalizeGeneratedImageUrl(existingImageUrl)

      if (normalizedImageUrl !== existingImageUrl) {
        const updatedChapter = injectGeneratedImage(chapter, normalizedImageUrl)
        const pages = buildFlatPages([normalizeChapter(updatedChapter, chapter.sourceIndex || 0)])

        replaceStoredGeneratedChapter(updatedChapter)
        pageContext.setData(Object.assign({
          flatPages: pages,
          totalPages: pages.length,
        }, buildReaderState(0, pages)))
      }

      return
    }

    if (!chapter.generationTaskId) {
      return
    }

    const task = await getGenerationTask(chapter.generationTaskId)

    if (!task || task.status !== 'completed') {
      return
    }

    const imageUrl = getFirstGenerationImageUrl(task)

    if (!imageUrl) {
      return
    }

    const updatedChapter = injectGeneratedImage(chapter, imageUrl)
    const pages = buildFlatPages([normalizeChapter(updatedChapter, chapter.sourceIndex || 0)])

    replaceStoredGeneratedChapter(updatedChapter)
    pageContext.setData(Object.assign({
      flatPages: pages,
      totalPages: pages.length,
    }, buildReaderState(0, pages)))
  } catch (error) {
  }
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
    const chapterId = options && options.chapterId
    const readableChapters = chapters.map((chapter, index) => {
      return chapter.sortTime === undefined ? normalizeChapter(chapter, index) : chapter
    })
    const chapter = findChapterForReader(readableChapters, chapterId)
    const pages = chapter ? buildFlatPages([chapter]) : []

    this.setData(Object.assign({
      flatPages: pages,
      totalPages: pages.length,
    }, buildReaderState(0, pages)))

    healGeneratedChapterImage(this, chapter)
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

    if (deltaX < -threshold) {
      this.goNextPage()
      return
    }

    if (deltaX > threshold) {
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
  healGeneratedChapterImage,
  injectGeneratedImage,
  normalizeGeneratedImageUrl,
}
