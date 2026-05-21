const { generatingMock, pageRoutes, storageKeys } = require('../../utils/mock')
const { getAuthToken } = require('../../utils/auth')
const { saveDraftWithBackendFallback } = require('../../utils/diarySync')
const { createGenerationTask } = require('../../utils/generationTaskApi')

function getDefaultPanelImages() {
  return [
    '/subpackage/icon-home-mascot-star.png',
    '/subpackage/icon-home-heart.png',
    '/subpackage/icon-home-smile.png',
    '/subpackage/icon-home-star-badge.png',
  ]
}

function buildGeneratedChapter(draft) {
  const chapterTitle = draft && draft.chapterTitle ? draft.chapterTitle : generatingMock.chapterTitle
  const pageCount = Math.max(2, Number(draft && draft.pageCount ? draft.pageCount : 2))
  const photoPath = draft && (draft.photoPath || (draft.photoItem && draft.photoItem.path) || draft.imagePath)
  const primaryImages = photoPath ? [photoPath] : getDefaultPanelImages()
  const defaultImages = getDefaultPanelImages()
  const pages = Array.from({ length: pageCount }).map((_, index) => {
    const pageImages = photoPath
      ? [photoPath]
      : (index === 0 ? defaultImages.slice(0, 2) : defaultImages.slice(2, 4))

    return {
      pageId: `${chapterTitle}-${index + 1}`,
      images: pageImages.length > 0 ? pageImages : defaultImages,
      caption: index === 0
        ? `${draft && draft.diaryText ? draft.diaryText : '今天的故事'}`
        : `第 ${index + 1} 页的漫画分镜。`,
    }
  })

  return {
    id: `local-${Date.now()}`,
    title: chapterTitle,
    date: draft && draft.diaryDate ? draft.diaryDate : '2026-05-18',
    chapterNo: 1,
    chapterIndex: 0,
    diaryText: draft && draft.diaryText ? draft.diaryText : '',
    summary: draft && draft.diaryText ? draft.diaryText.slice(0, 24) : '今天的故事',
    caption: draft && draft.diaryText ? draft.diaryText.slice(0, 24) : '今天的故事',
    images: primaryImages,
    pages,
  }
}

function loadGeneratedChapters() {
  return wx.getStorageSync(storageKeys.generatedComicChapters) || []
}

function saveGeneratedChapters(chapters) {
  wx.setStorageSync(storageKeys.generatedComicChapters, chapters)
}

function loadPendingDraft() {
  return wx.getStorageSync(storageKeys.draftComicChapter) || null
}

function buildGenerationTaskMetadata(task) {
  if (!task || !task.id) {
    return {}
  }

  return {
    generationTaskId: task.id,
    generationTaskStatus: task.status,
    serverDiaryEntryId: task.diaryEntryId,
    generationResult: task.result || {},
  }
}

function finalizeGeneratedChapter(draft, task) {
  const generatedChapter = Object.assign(
    buildGeneratedChapter(draft),
    buildGenerationTaskMetadata(task)
  )
  const generatedChapters = [generatedChapter].concat(loadGeneratedChapters())

  saveGeneratedChapters(generatedChapters)

  return generatedChapter
}

async function createBackendTaskForDraft(draft) {
  if (!getAuthToken()) {
    return null
  }

  if (draft && draft.serverDiaryEntryId) {
    return createGenerationTask(draft.serverDiaryEntryId)
  }

  const syncedDraft = await saveDraftWithBackendFallback(draft || {})
  const diaryEntryId = syncedDraft && syncedDraft.serverDiaryEntryId

  if (!diaryEntryId) {
    return null
  }

  return createGenerationTask(diaryEntryId)
}

async function finalizeGeneratedChapterWithBackendFallback(draft) {
  try {
    const task = await createBackendTaskForDraft(draft)
    return finalizeGeneratedChapter(draft, task)
  } catch (error) {
    return finalizeGeneratedChapter(draft)
  }
}

Page({
  timer: null,

  data: {
    mock: generatingMock,
    progress: generatingMock.progressStart,
    activeStepIndex: 0,
    canViewChapter: false,
    pendingDraft: null,
    generatedChapterId: '',
  },

  onLoad() {
    this.setData({
      pendingDraft: loadPendingDraft(),
    })
    this.startMockProgress()
  },

  onUnload() {
    this.clearMockTimer()
  },

  startMockProgress() {
    this.clearMockTimer()

    this.timer = setInterval(() => {
      const nextProgress = Math.min(this.data.progress + 9, 100)
      const activeStepIndex = Math.min(
        Math.floor((nextProgress / 100) * this.data.mock.steps.length),
        this.data.mock.steps.length - 1
      )

      this.setData({
        progress: nextProgress,
        activeStepIndex,
        canViewChapter: nextProgress >= 100,
      })

      if (nextProgress >= 100) {
        finalizeGeneratedChapterWithBackendFallback(this.data.pendingDraft).then((generatedChapter) => {
          this.setData({
            generatedChapterId: generatedChapter.id,
          })
        })
        this.clearMockTimer()
      }
    }, 800)
  },

  clearMockTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  goChapterDetail() {
    wx.navigateTo({
      url: `${pageRoutes.continuousChapter}?chapterId=${this.data.generatedChapterId}`,
    })
  },

  retryTask() {
    wx.showToast({
      title: '当前为失败重试占位',
      icon: 'none',
    })
  },
})

module.exports = {
  buildGeneratedChapter,
  finalizeGeneratedChapter,
  finalizeGeneratedChapterWithBackendFallback,
  loadGeneratedChapters,
  saveGeneratedChapters,
  loadPendingDraft,
  getDefaultPanelImages,
  buildGenerationTaskMetadata,
}
