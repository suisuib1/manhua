const { homeMock, pageRoutes, chapterStatuses, storageKeys } = require('../../utils/mock')
const { getAuthToken, loginWithWechat } = require('../../utils/auth')
const { getRecentComicChapters } = require('../../utils/comicChapterApi')
const { getGenerationTask } = require('../../utils/generationTaskApi')
const apiConfig = require('../../config/api.config')

const statusClassMap = {
  [chapterStatuses.completed]: 'is-completed',
  pending: 'is-generating',
  processing: 'is-generating',
  [chapterStatuses.generating]: 'is-generating',
  [chapterStatuses.failed]: 'is-failed',
}

const statusTextMap = {
  pending: '生成中',
  processing: '生成中',
  [chapterStatuses.generating]: '生成中',
  [chapterStatuses.completed]: '已完成',
  [chapterStatuses.failed]: '生成失败',
}

function formatRecentChapterDate(value) {
  if (!value) {
    return ''
  }

  const text = String(value)
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/)

  return isoDate ? isoDate[1] : text
}

function getRecentChapterStatusText(chapter) {
  return statusTextMap[chapter.status] || chapter.statusText || ''
}

function normalizeImageUrl(imageUrl) {
  if (!imageUrl || /^https?:\/\//.test(imageUrl) || /^wxfile:\/\//.test(imageUrl)) {
    return imageUrl || ''
  }

  return `${apiConfig.baseUrl}${imageUrl.indexOf('/') === 0 ? imageUrl : `/${imageUrl}`}`
}

function buildReaderChapterFromRecent(chapter) {
  const coverImageUrl = normalizeImageUrl(chapter && chapter.coverImageUrl)
  const id = chapter && (chapter.id || chapter.diaryEntryId || chapter.generationTaskId)
  const pageCount = Math.max(1, Number(chapter && chapter.pageCount ? chapter.pageCount : 1))
  const pages = coverImageUrl
    ? [{
      pageId: `${id || 'recent'}-page-1`,
      pageIndex: 0,
      images: [coverImageUrl],
      imageUrl: coverImageUrl,
      caption: chapter.summary || chapter.subtitle || '',
    }]
    : []

  return Object.assign({}, chapter, {
    id,
    diaryEntryId: chapter && chapter.diaryEntryId,
    generationTaskId: chapter && chapter.generationTaskId,
    title: chapter && chapter.title,
    date: (chapter && (chapter.date || chapter.createdAt || chapter.updatedAt)) || '',
    pageCount,
    coverImageUrl,
    imageUrl: coverImageUrl,
    images: coverImageUrl ? [coverImageUrl] : [],
    pages,
  })
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

function getLocalPendingRecentChapters() {
  const chapters = wx.getStorageSync(storageKeys.generatedComicChapters) || []
  return chapters.filter((chapter) => {
    const status = chapter && (chapter.status || chapter.generationTaskStatus)
    return isTaskInProgress(status) || status === chapterStatuses.failed
  })
}

function mergeRecentChapters(primaryChapters, localPendingChapters) {
  const merged = []

  function mergeChapter(chapter, replaceExisting) {
    const normalized = normalizeRecentChapter(chapter)
    const key = getChapterMergeKey(normalized)
    if (!key) {
      return
    }

    const existingIndex = merged.findIndex((item) => getChapterMergeKey(item) === key)
    if (existingIndex >= 0) {
      if (replaceExisting) {
        merged[existingIndex] = normalized
      }
      return
    }

    merged.push(normalized)
  }

  ;(localPendingChapters || []).forEach((chapter) => {
    mergeChapter(chapter, false)
  })

  ;(primaryChapters || []).forEach((chapter) => {
    mergeChapter(chapter, true)
  })

  return merged
}

function upsertReaderChapter(chapter) {
  if (!chapter || !chapter.id) {
    return
  }

  const chapters = wx.getStorageSync(storageKeys.generatedComicChapters) || []
  const readerChapter = buildReaderChapterFromRecent(chapter)
  if (!readerChapter.imageUrl) {
    return
  }

  const nextChapters = [readerChapter].concat(chapters.filter((item) => {
    return item.id !== readerChapter.id && item.diaryEntryId !== readerChapter.id
  }))

  wx.setStorageSync(storageKeys.generatedComicChapters, nextChapters)
}

function saveRecentChapterAsPendingDraft(chapter, task) {
  if (!chapter) {
    return
  }

  wx.setStorageSync(storageKeys.draftComicChapter, Object.assign({}, chapter, {
    chapterTitle: chapter.title,
    serverDiaryEntryId: chapter.diaryEntryId || chapter.id,
    generationTaskId: (task && task.id) || chapter.generationTaskId,
    generationTaskStatus: (task && task.status) || chapter.status,
    generationResult: (task && task.result) || chapter.generationResult || {},
  }))
}

function navigateToGenerating(chapter, task) {
  saveRecentChapterAsPendingDraft(chapter, task)

  const taskId = (task && task.id) || chapter.generationTaskId
  const taskStatus = (task && task.status) || chapter.status || ''

  wx.navigateTo({
    url: `${pageRoutes.generating}?taskId=${taskId || ''}&taskStatus=${taskStatus}`,
  })
}

function isTaskInProgress(status) {
  return status === 'pending' || status === 'processing' || status === chapterStatuses.generating
}

function getTaskImageUrl(task) {
  const pages = task && task.result && Array.isArray(task.result.pages) ? task.result.pages : []
  const firstPage = pages[0]
  return normalizeImageUrl(firstPage && firstPage.imageUrl)
}

function mergeTaskImageIntoChapter(chapter, task) {
  const imageUrl = getTaskImageUrl(task)
  if (!imageUrl) {
    return chapter
  }

  return buildReaderChapterFromRecent(Object.assign({}, chapter, {
    status: task.status,
    generationTaskStatus: task.status,
    generationResult: task.result || {},
    coverImageUrl: imageUrl,
  }))
}

function buildFallbackRecentChapters() {
  return homeMock.recentChapters.map((chapter) => Object.assign({}, chapter, {
    displayDate: formatRecentChapterDate(chapter.createdAt || chapter.date),
    displaySubtitle: chapter.summary || chapter.subtitle || '',
    statusClass: statusClassMap[chapter.status] || '',
    statusText: getRecentChapterStatusText(chapter),
  }))
}

function normalizeRecentChapter(chapter) {
  const pageCount = Number(chapter.pageCount || 0)
  const coverImageUrl = normalizeImageUrl(chapter.coverImageUrl || '')
  const readerChapter = buildReaderChapterFromRecent(Object.assign({}, chapter, {
    coverImageUrl,
  }))

  return Object.assign({}, chapter, {
    id: chapter.id || chapter.diaryEntryId || chapter.generationTaskId,
    subtitle: chapter.subtitle || chapter.title || '',
    coverImageUrl,
    imageUrl: readerChapter.imageUrl,
    images: readerChapter.images,
    pages: readerChapter.pages,
    displayDate: formatRecentChapterDate(chapter.createdAt || chapter.date),
    displaySubtitle: chapter.summary || chapter.subtitle || '',
    statusClass: statusClassMap[chapter.status] || '',
    statusText: getRecentChapterStatusText(chapter),
    pageCountText: pageCount > 0 ? `${pageCount} 页` : '',
  })
}

Page({
  isLoadingRecent: false,

  data: {
    user: homeMock.user,
    defaultComicBook: homeMock.defaultComicBook,
    freeQuotaRemaining: homeMock.freeQuotaRemaining,
    quotaHint: homeMock.quotaHint,
    recentChapters: buildFallbackRecentChapters(),
    isRecentChaptersEmpty: false,
    showLoginModal: false,
  },

  onLoad() {
    return null
  },

  onShow() {
    return this.loadRecentChapters()
  },

  async loadRecentChapters() {
    if (this.isLoadingRecent || !getAuthToken()) {
      return null
    }

    this.isLoadingRecent = true

    try {
      const data = await getRecentComicChapters({ limit: 5 })
      const items = data && Array.isArray(data.items) ? data.items : []
      const recentChapters = mergeRecentChapters(items, getLocalPendingRecentChapters())

      this.setData({
        recentChapters,
        isRecentChaptersEmpty: recentChapters.length === 0,
      })

      return data
    } catch (error) {
      return null
    } finally {
      this.isLoadingRecent = false
    }
  },

  requireLogin(nextAction) {
    if (getAuthToken()) {
      if (typeof nextAction === 'function') {
        return nextAction()
      }
      return true
    }

    this.setData({
      showLoginModal: true,
    })
    return false
  },

  closeLoginModal() {
    this.setData({
      showLoginModal: false,
    })
  },

  async confirmLogin() {
    try {
      await loginWithWechat({})
      this.setData({
        showLoginModal: false,
      })
      await this.loadRecentChapters()
    } catch (error) {
      const title = error && error.statusCode === 0 && error.message
        ? error.message
        : '登录失败，请稍后重试'

      wx.showToast({
        title,
        icon: 'none',
      })
    }
  },

  goCreateChapter() {
    this.requireLogin(() => {
      wx.switchTab({
        url: pageRoutes.create,
      })
    })
  },

  async goChapterDetail(event) {
    const { id } = event.currentTarget.dataset

    return this.requireLogin(async () => {
      const chapter = this.data.recentChapters.find((item) => item.id === id || item.diaryEntryId === id)
      let readerChapter = chapter

      if (chapter && chapter.generationTaskId) {
        try {
          const task = await getGenerationTask(chapter.generationTaskId)
          if (isTaskInProgress(task && task.status)) {
            navigateToGenerating(chapter, task)
            return
          }

          if (task && task.status === chapterStatuses.failed) {
            navigateToGenerating(chapter, task)
            return
          }

          if (task && task.status === chapterStatuses.completed) {
            readerChapter = mergeTaskImageIntoChapter(chapter, task)
          }
        } catch (error) {
          if (isTaskInProgress(chapter.status) || chapter.status === chapterStatuses.failed) {
            navigateToGenerating(chapter)
            return
          }
        }
      }

      upsertReaderChapter(readerChapter)

      wx.navigateTo({
        url: `${pageRoutes.continuousChapter}?chapterId=${id}`,
      })
    })
  },

  goCharacter() {
    this.requireLogin(() => {
      wx.navigateTo({
        url: pageRoutes.character,
      })
    })
  },

  goMine() {
    this.requireLogin(() => {
      wx.switchTab({
        url: pageRoutes.mine,
      })
    })
  },

})

module.exports = {
  buildFallbackRecentChapters,
  formatRecentChapterDate,
  normalizeRecentChapter,
  buildReaderChapterFromRecent,
  normalizeImageUrl,
  isTaskInProgress,
  getTaskImageUrl,
  getChapterMergeKey,
  getLocalPendingRecentChapters,
  mergeRecentChapters,
}
