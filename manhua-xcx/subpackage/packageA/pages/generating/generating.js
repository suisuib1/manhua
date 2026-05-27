const { generatingMock, pageRoutes, storageKeys } = require('../../../../utils/mock')
const { getAuthToken } = require('../../../../utils/auth')
const { saveDraftWithBackendFallback } = require('../../../../utils/diarySync')
const { createGenerationTask, getGenerationTask } = require('../../../../utils/generationTaskApi')
const apiConfig = require('../../../../config/api.config')

const generationTaskPollIntervalMs = 2500
const generationTaskMaxPollCount = 48
const generationFailureTitle = '生成失败'
const generationFailureMessage = '漫画生成超时，请稍后重新生成'
const generationProcessingTitle = '正在生成中'
let generationTaskPollTimer = null

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

function savePendingDraftWithTask(draft, task) {
  if (!draft || !task || !task.id) {
    return
  }

  wx.setStorageSync(storageKeys.draftComicChapter, Object.assign({}, draft, {
    generationTaskId: task.id,
    generationTaskStatus: task.status,
    serverDiaryEntryId: task.diaryEntryId || draft.serverDiaryEntryId,
    generationResult: task.result || {},
  }))
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

function getFirstGenerationImageUrl(task) {
  const pages = task && task.result && Array.isArray(task.result.pages) ? task.result.pages : []
  const firstPage = pages[0]

  return firstPage && firstPage.imageUrl ? normalizeGeneratedImageUrl(firstPage.imageUrl) : ''
}

function normalizeGeneratedImageUrl(imageUrl) {
  if (!imageUrl || /^https?:\/\//.test(imageUrl) || /^wxfile:\/\//.test(imageUrl)) {
    return imageUrl || ''
  }

  return `${apiConfig.baseUrl}${imageUrl.indexOf('/') === 0 ? imageUrl : `/${imageUrl}`}`
}

function injectFirstGeneratedImage(chapter, imageUrl) {
  if (!imageUrl || !chapter) {
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

function resetGenerationTaskState(pageContext) {
  clearGenerationTaskPollTimer()

  if (pageContext && typeof pageContext.setData === 'function') {
    pageContext.setData({
      generationTaskId: '',
      generationTaskStatus: '',
      generationResult: {},
      generationStatus: 'processing',
      generationTitle: generationProcessingTitle,
      generationFailureTitle: '',
      generationFailureMessage: '',
    })
  }
}

function updateGenerationTaskState(pageContext, task) {
  if (!pageContext || typeof pageContext.setData !== 'function' || !task || !task.id) {
    return
  }

  pageContext.setData({
    generationTaskId: task.id,
    generationTaskStatus: task.status,
    generationResult: task.result || {},
  })

  savePendingDraftWithTask(pageContext.data && pageContext.data.pendingDraft, task)
}

function finalizeGeneratedChapter(draft, task) {
  const generatedChapter = injectFirstGeneratedImage(
    Object.assign(
      buildGeneratedChapter(draft),
      buildGenerationTaskMetadata(task)
    ),
    getFirstGenerationImageUrl(task)
  )
  const generatedChapters = [generatedChapter].concat(loadGeneratedChapters())

  saveGeneratedChapters(generatedChapters)

  return generatedChapter
}

function clearGenerationTaskPollTimer() {
  if (generationTaskPollTimer) {
    clearInterval(generationTaskPollTimer)
    generationTaskPollTimer = null
  }
}

function buildFailedGenerationTask(task) {
  return Object.assign({}, task || {}, {
    status: 'failed',
  })
}

function enterGenerationFailedState(pageContext, task) {
  clearGenerationTaskPollTimer()

  if (pageContext && typeof pageContext.clearMockTimer === 'function') {
    pageContext.clearMockTimer()
  }

  if (pageContext && typeof pageContext.setData === 'function') {
    pageContext.setData({
      generationStatus: 'failed',
      generationTitle: generationProcessingTitle,
      generationFailureTitle,
      generationFailureMessage,
      generationTaskStatus: task && task.status ? task.status : 'failed',
      generationResult: task && task.result ? task.result : {},
      canViewChapter: false,
      generatedChapterId: '',
    })
  }
}

function waitForGenerationTaskResult(task, pageContext) {
  if (!task || !task.id) {
    return Promise.resolve(task || null)
  }

  updateGenerationTaskState(pageContext, task)

  if (task.status === 'completed') {
    return Promise.resolve(task)
  }

  if (task.status === 'failed') {
    return Promise.resolve(task)
  }

  clearGenerationTaskPollTimer()

  return new Promise((resolve) => {
    let pollCount = 0
    let latestKnownTask = task

    generationTaskPollTimer = setInterval(async () => {
      pollCount += 1

      if (pollCount > generationTaskMaxPollCount) {
        clearGenerationTaskPollTimer()
        const failedTask = buildFailedGenerationTask(latestKnownTask)
        updateGenerationTaskState(pageContext, failedTask)
        resolve(failedTask)
        return
      }

      try {
        const taskId = task.id
        console.info('[generation] polling taskId', taskId)
        const latestTask = await getGenerationTask(taskId)
        latestKnownTask = latestTask || latestKnownTask
        updateGenerationTaskState(pageContext, latestTask)

        if (latestTask.status === 'completed') {
          console.info('[generation] completed taskId imageUrl', latestTask.id, getFirstGenerationImageUrl(latestTask))
          clearGenerationTaskPollTimer()
          resolve(latestTask)
          return
        }

        if (latestTask.status === 'failed') {
          clearGenerationTaskPollTimer()
          resolve(latestTask)
        }
      } catch (error) {
        clearGenerationTaskPollTimer()
        const failedTask = buildFailedGenerationTask(latestKnownTask)
        updateGenerationTaskState(pageContext, failedTask)
        resolve(failedTask)
      }
    }, generationTaskPollIntervalMs)
  })
}

async function createBackendTaskForDraft(draft) {
  if (!getAuthToken()) {
    return null
  }

  if (draft && draft.serverDiaryEntryId) {
    const task = await createGenerationTask(draft.serverDiaryEntryId)
    console.info('[generation] created taskId', task.id)
    return task
  }

  const syncedDraft = await saveDraftWithBackendFallback(draft || {})
  const diaryEntryId = syncedDraft && syncedDraft.serverDiaryEntryId

  if (!diaryEntryId) {
    return null
  }

  const task = await createGenerationTask(diaryEntryId)
  console.info('[generation] created taskId', task.id)
  return task
}

async function finalizeGeneratedChapterWithBackendFallback(draft, pageContext) {
  resetGenerationTaskState(pageContext)

  try {
    const task = await createBackendTaskForDraft(draft)
    if (!task) {
      return finalizeGeneratedChapter(draft)
    }

    savePendingDraftWithTask(draft, task)
    updateGenerationTaskState(pageContext, task)
    const readyTask = await waitForGenerationTaskResult(task, pageContext)
    if (readyTask && readyTask.status === 'failed') {
      enterGenerationFailedState(pageContext, readyTask)
      return null
    }

    return finalizeGeneratedChapter(draft, readyTask)
  } catch (error) {
    enterGenerationFailedState(pageContext)
    return null
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
    generationTaskId: '',
    generationTaskStatus: '',
    generationResult: {},
    generationStatus: 'processing',
    generationTitle: generationProcessingTitle,
    generationFailureTitle: '',
    generationFailureMessage: '',
  },

  onLoad(options) {
    const pendingDraft = loadPendingDraft()
    this.setData({
      pendingDraft,
    })

    if (options && options.taskId) {
      const taskStatus = options.taskStatus || ''
      this.setData({
        generationTaskId: options.taskId,
        generationTaskStatus: taskStatus,
        generationStatus: taskStatus === 'failed' ? 'failed' : 'processing',
        generationTitle: generationProcessingTitle,
        generationFailureTitle: taskStatus === 'failed' ? generationFailureTitle : '',
        generationFailureMessage: taskStatus === 'failed' ? generationFailureMessage : '',
        canViewChapter: false,
      })
      return
    }

    this.startMockProgress()
  },

  onUnload() {
    this.clearMockTimer()
    clearGenerationTaskPollTimer()
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
        canViewChapter: false,
      })

      if (nextProgress >= 100) {
        finalizeGeneratedChapterWithBackendFallback(this.data.pendingDraft, this).then((generatedChapter) => {
          if (generatedChapter && generatedChapter.id) {
            this.setData({
              generatedChapterId: generatedChapter.id,
              generationStatus: 'completed',
              canViewChapter: true,
            })
          }
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

  goHome() {
    wx.switchTab({
      url: pageRoutes.home,
    })
  },

  retryGeneration() {
    clearGenerationTaskPollTimer()
    this.clearMockTimer()
    this.setData({
      progress: generatingMock.progressStart,
      activeStepIndex: 0,
      canViewChapter: false,
      generatedChapterId: '',
      generationTaskId: '',
      generationTaskStatus: '',
      generationResult: {},
      generationStatus: 'processing',
      generationTitle: generationProcessingTitle,
      generationFailureTitle: '',
      generationFailureMessage: '',
    })
    this.startMockProgress()
  },
})

module.exports = {
  buildGeneratedChapter,
  finalizeGeneratedChapter,
  finalizeGeneratedChapterWithBackendFallback,
  loadGeneratedChapters,
  saveGeneratedChapters,
  loadPendingDraft,
  savePendingDraftWithTask,
  getDefaultPanelImages,
  buildGenerationTaskMetadata,
  getFirstGenerationImageUrl,
  normalizeGeneratedImageUrl,
  injectFirstGeneratedImage,
  waitForGenerationTaskResult,
  clearGenerationTaskPollTimer,
  enterGenerationFailedState,
  generationTaskPollIntervalMs,
  generationTaskMaxPollCount,
  generationFailureTitle,
  generationFailureMessage,
  generationProcessingTitle,
}
