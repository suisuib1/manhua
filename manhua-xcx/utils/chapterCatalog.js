const { homeMock, storageKeys } = require('./mock')

function loadStoredChapters() {
  return wx.getStorageSync(storageKeys.generatedComicChapters) || []
}

function getChapterId(chapter, fallbackIndex) {
  return chapter && (chapter.id || chapter.chapterId || `chapter-${fallbackIndex + 1}`)
}

function getChapterTimestamp(chapter, fallbackIndex) {
  const value = chapter && (chapter.date || chapter.createdAt || chapter.updatedAt || chapter.diaryDate)
  const time = value ? Date.parse(value) : Number.NaN

  return Number.isNaN(time) ? -fallbackIndex : time
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

  ;['imageUrl', 'coverImageUrl', 'coverImage', 'cover', 'generatedImage'].forEach((field) => {
    const image = pickImageUrl(chapter[field])
    if (image) images.push(image)
  })

  return images
}

function getChapterPageCount(chapter) {
  const pageCount = Number(chapter && chapter.pageCount)
  if (Number.isFinite(pageCount) && pageCount > 0) {
    return pageCount
  }

  if (chapter && Array.isArray(chapter.pages) && chapter.pages.length > 0) {
    return chapter.pages.length
  }

  return getChapterImages(chapter).length
}

function getChapterStatus(chapter) {
  return chapter && (chapter.status || chapter.generationTaskStatus || '')
}

function isTaskInProgress(status) {
  return status === 'pending' || status === 'processing' || status === 'generating'
}

function shouldMergeLocalChapter(chapter) {
  const status = getChapterStatus(chapter)

  return isTaskInProgress(status) || status === 'failed' || (status === 'completed' && !chapter.generationTaskId)
}

function getChapterMergeKey(chapter) {
  if (!chapter) {
    return ''
  }

  if (chapter.generationTaskId) {
    return `task:${chapter.generationTaskId}`
  }

  const diaryEntryId = chapter.diaryEntryId || chapter.serverDiaryEntryId
  if (diaryEntryId) {
    return `diary:${diaryEntryId}`
  }

  return chapter.id ? `id:${chapter.id}` : ''
}

function mergeRealAndLocalChapters(realChapters, localChapters) {
  const merged = []

  function mergeChapter(chapter, replaceExisting) {
    const key = getChapterMergeKey(chapter)
    if (!key) {
      return
    }

    const existingIndex = merged.findIndex((item) => getChapterMergeKey(item) === key)
    if (existingIndex >= 0) {
      if (replaceExisting) {
        merged[existingIndex] = chapter
      }
      return
    }

    merged.push(chapter)
  }

  ;(localChapters || []).filter(shouldMergeLocalChapter).forEach((chapter) => {
    mergeChapter(chapter, false)
  })

  ;(realChapters || []).forEach((chapter) => {
    mergeChapter(chapter, true)
  })

  return buildChapterList([], merged)
}

function normalizeChapter(chapter, sourceIndex) {
  const id = getChapterId(chapter, sourceIndex)
  const pageCount = getChapterPageCount(chapter)
  const status = getChapterStatus(chapter)

  return Object.assign({}, chapter, {
    id,
    title: chapter.title || chapter.chapterTitle || chapter.subtitle || `第 ${sourceIndex + 1} 章`,
    subtitle: chapter.subtitle || chapter.chapterTitle || chapter.title || '',
    date: chapter.date || chapter.diaryDate || '',
    status,
    statusText: chapter.statusText || (status === 'failed' ? '生成失败' : (isTaskInProgress(status) ? '生成中' : '已完成')),
    pageCount,
    pageCountText: `${pageCount} 页`,
    coverImage: getChapterImages(chapter)[0] || '/subpackage/icon-home-mascot-star.png',
    tags: chapter.tags || chapter.selectedTags || [],
    sourceIndex,
    sortTime: getChapterTimestamp(chapter, sourceIndex),
  })
}

function buildChapterList(defaultChapters, storedChapters) {
  const normalizedChapters = storedChapters.concat(defaultChapters)
    .map((chapter, index) => normalizeChapter(chapter, index))
    .sort((a, b) => {
      if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime
      return a.sourceIndex - b.sourceIndex
    })
  const merged = []
  const seenIds = new Set()

  normalizedChapters.forEach((chapter) => {
    if (seenIds.has(chapter.id)) return

    seenIds.add(chapter.id)
    merged.push(chapter)
  })

  return merged
}

function buildReadableChapters() {
  return buildChapterList(homeMock.recentChapters, loadStoredChapters())
}

module.exports = {
  buildChapterList,
  getChapterMergeKey,
  buildReadableChapters,
  collectImageUrls,
  getChapterImages,
  getChapterPageCount,
  getChapterStatus,
  isTaskInProgress,
  loadStoredChapters,
  mergeRealAndLocalChapters,
  normalizeChapter,
  pickImageUrl,
  shouldMergeLocalChapter,
}
