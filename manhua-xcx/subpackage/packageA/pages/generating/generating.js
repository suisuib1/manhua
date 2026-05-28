const { generatingMock, pageRoutes, storageKeys } = require('../../../../utils/mock')
const { getAuthToken } = require('../../../../utils/auth')
const { saveDraftWithBackendFallback } = require('../../../../utils/diarySync')
const { createGenerationTask, getGenerationTask } = require('../../../../utils/generationTaskApi')
const apiConfig = require('../../../../config/api.config')

const generationTaskPollIntervalMs = 2500
const generationTaskMaxPollCount = 48
const generationFailureTitle = '生成失败'
const generationFailureMessage = '图片服务暂时不可用，请稍后重试'
const generationPendingTitle = '任务已提交'
const generationProcessingTitle = '正在生成中'
const generationPendingProgress = 15
const generationProcessingMaxProgress = 88
const generationProcessingProgressStep = 3
let generationTaskPollTimer = null

function isGenerationTaskFailed(status) {
  return status === 'failed'
}

function isGenerationTaskProcessing(status) {
  return status === 'pending' || status === 'processing'
}

function isGenerationTaskCompletedWithImage(task) {
  return task && task.status === 'completed' && Boolean(getFirstGenerationImageUrl(task))
}

function getGenerationTitleByStatus(status) {
  return status === 'pending' ? generationPendingTitle : generationProcessingTitle
}

function getGenerationProgressByTask(task, currentProgress) {
  const status = task && task.status
  const progress = Number(currentProgress)
  const safeProgress = Number.isFinite(progress) ? progress : generationPendingProgress

  if (isGenerationTaskCompletedWithImage(task)) {
    return 100
  }

  if (status === 'pending') {
    return generationPendingProgress
  }

  if (status === 'processing') {
    return Math.min(
      Math.max(safeProgress, generationPendingProgress) + generationProcessingProgressStep,
      generationProcessingMaxProgress
    )
  }

  return safeProgress
}

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

function getChapterDiaryEntryId(chapter) {
  return chapter && (chapter.diaryEntryId || chapter.serverDiaryEntryId)
}

function isSameGeneratedChapter(left, right) {
  if (!left || !right) {
    return false
  }

  if (left.generationTaskId && right.generationTaskId) {
    if (left.generationTaskId === right.generationTaskId) {
      return true
    }
  }

  const leftDiaryEntryId = getChapterDiaryEntryId(left)
  const rightDiaryEntryId = getChapterDiaryEntryId(right)
  if (leftDiaryEntryId && rightDiaryEntryId) {
    return leftDiaryEntryId === rightDiaryEntryId
  }

  return Boolean(left.id && right.id && left.id === right.id)
}

function upsertGeneratedChapter(chapter) {
  if (!chapter || !chapter.id) {
    return loadGeneratedChapters()
  }

  const chapters = loadGeneratedChapters()
  const existingIndex = chapters.findIndex((item) => isSameGeneratedChapter(item, chapter))
  if (existingIndex < 0) {
    const nextChapters = [chapter].concat(chapters)
    saveGeneratedChapters(nextChapters)
    return nextChapters
  }

  const nextChapters = chapters.slice()
  nextChapters[existingIndex] = Object.assign({}, chapters[existingIndex], chapter)
  saveGeneratedChapters(nextChapters)
  return nextChapters
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

function buildPendingGeneratedChapter(draft, task) {
  const taskId = (task && task.id) || (draft && draft.generationTaskId)
  const diaryEntryId = (task && task.diaryEntryId) || (draft && (draft.serverDiaryEntryId || draft.diaryEntryId))

  if (!taskId && !diaryEntryId) {
    return null
  }

  return {
    id: taskId ? `pending_${taskId}` : `pending_${diaryEntryId}`,
    diaryEntryId,
    serverDiaryEntryId: diaryEntryId,
    generationTaskId: taskId,
    generationTaskStatus: (task && task.status) || (draft && draft.generationTaskStatus) || 'processing',
    generationResult: (task && task.result) || (draft && draft.generationResult) || {},
    status: (task && task.status) || (draft && draft.generationTaskStatus) || 'processing',
    title: (draft && (draft.chapterTitle || draft.title)) || generatingMock.chapterTitle,
    date: draft && draft.diaryDate ? draft.diaryDate : '',
    pageCount: Math.max(1, Number(draft && draft.pageCount ? draft.pageCount : 1)),
    diaryText: draft && draft.diaryText ? draft.diaryText : '',
    summary: draft && draft.diaryText ? draft.diaryText.slice(0, 24) : '',
    images: [],
    pages: [],
  }
}

function savePendingGeneratedChapter(draft, task) {
  const pendingChapter = buildPendingGeneratedChapter(draft, task)
  if (!pendingChapter) {
    return null
  }

  upsertGeneratedChapter(pendingChapter)
  return pendingChapter
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
      generationTitle: generationPendingTitle,
      progress: generationPendingProgress,
      generationFailureTitle: '',
      generationFailureMessage: '',
    })
  }
}

function updateGenerationTaskState(pageContext, task) {
  if (!pageContext || typeof pageContext.setData !== 'function' || !task || !task.id) {
    return
  }

  const patch = {
    generationTaskId: task.id,
    generationTaskStatus: task.status,
    generationResult: task.result || {},
  }

  if (isGenerationTaskProcessing(task.status)) {
    patch.generationStatus = 'processing'
    patch.generationTitle = getGenerationTitleByStatus(task.status)
    patch.progress = getGenerationProgressByTask(task, pageContext.data && pageContext.data.progress)
    patch.generationFailureTitle = ''
    patch.generationFailureMessage = ''
    patch.canViewChapter = false
  }

  if (isGenerationTaskCompletedWithImage(task)) {
    patch.generationStatus = 'completed'
    patch.progress = 100
    patch.generationFailureTitle = ''
    patch.generationFailureMessage = ''
  }

  pageContext.setData(patch)

  savePendingDraftWithTask(pageContext.data && pageContext.data.pendingDraft, task)
  if (isGenerationTaskProcessing(task.status) || isGenerationTaskFailed(task.status)) {
    savePendingGeneratedChapter(pageContext.data && pageContext.data.pendingDraft, task)
  }
}

function finalizeGeneratedChapter(draft, task) {
  const generatedChapter = injectFirstGeneratedImage(
    Object.assign(
      buildGeneratedChapter(draft),
      buildGenerationTaskMetadata(task)
    ),
    getFirstGenerationImageUrl(task)
  )
  upsertGeneratedChapter(generatedChapter)

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

function enterGenerationProcessingState(pageContext, task) {
  clearGenerationTaskPollTimer()

  if (pageContext && typeof pageContext.clearMockTimer === 'function') {
    pageContext.clearMockTimer()
  }

  if (pageContext && typeof pageContext.setData === 'function') {
    pageContext.setData({
      generationStatus: 'processing',
      generationTitle: getGenerationTitleByStatus(task && task.status),
      progress: getGenerationProgressByTask(task, pageContext.data && pageContext.data.progress),
      generationFailureTitle: '',
      generationFailureMessage: '',
      generationTaskStatus: task && task.status ? task.status : 'processing',
      generationResult: task && task.result ? task.result : {},
      canViewChapter: false,
    })
  }
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
      progress: getGenerationProgressByTask(task, pageContext.data && pageContext.data.progress),
      generationTaskStatus: task && task.status ? task.status : 'failed',
      generationResult: task && task.result ? task.result : {},
      canViewChapter: false,
      generatedChapterId: '',
    })
  }

  savePendingGeneratedChapter(pageContext && pageContext.data && pageContext.data.pendingDraft, task)
}

function waitForGenerationTaskResult(task, pageContext) {
  if (!task || !task.id) {
    return Promise.resolve(task || null)
  }

  updateGenerationTaskState(pageContext, task)

  if (task.status === 'completed') {
    return Promise.resolve(task)
  }

  if (isGenerationTaskFailed(task.status)) {
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
        try {
          const finalTask = await getGenerationTask(task.id)
          latestKnownTask = finalTask || latestKnownTask
          updateGenerationTaskState(pageContext, latestKnownTask)
          if (!isGenerationTaskCompletedWithImage(latestKnownTask) && !isGenerationTaskFailed(latestKnownTask.status)) {
            latestKnownTask = buildFailedGenerationTask(latestKnownTask)
            enterGenerationFailedState(pageContext, latestKnownTask)
          }
          resolve(latestKnownTask)
        } catch (error) {
          const failedTask = buildFailedGenerationTask(latestKnownTask)
          enterGenerationFailedState(pageContext, failedTask)
          resolve(failedTask)
        }
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

        if (isGenerationTaskFailed(latestTask.status)) {
          clearGenerationTaskPollTimer()
          resolve(latestTask)
        }
      } catch (error) {
        clearGenerationTaskPollTimer()
        const failedTask = buildFailedGenerationTask(latestKnownTask)
        enterGenerationFailedState(pageContext, failedTask)
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
    if (isGenerationTaskCompletedWithImage(readyTask)) {
      return finalizeGeneratedChapter(draft, readyTask)
    }

    if (readyTask && readyTask.status === 'failed') {
      enterGenerationFailedState(pageContext, readyTask)
      return null
    }

    enterGenerationProcessingState(pageContext, readyTask)
    return null
  } catch (error) {
    enterGenerationFailedState(pageContext)
    return null
  }
}

Page({
  timer: null,

  data: {
    mock: generatingMock,
    progress: generationPendingProgress,
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
        generationStatus: isGenerationTaskFailed(taskStatus) ? 'failed' : 'processing',
        generationTitle: getGenerationTitleByStatus(taskStatus),
        progress: taskStatus === 'pending' ? generationPendingProgress : this.data.progress,
        generationFailureTitle: isGenerationTaskFailed(taskStatus) ? generationFailureTitle : '',
        generationFailureMessage: isGenerationTaskFailed(taskStatus) ? generationFailureMessage : '',
        canViewChapter: false,
      })
      this.syncLoadedGenerationTask(options.taskId)
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

    this.setData({
      progress: generationPendingProgress,
      activeStepIndex: 0,
      canViewChapter: false,
      generationStatus: 'processing',
      generationTitle: generationPendingTitle,
    })

    this.timer = setInterval(() => {
      if (this.data.generationStatus !== 'processing') {
        this.clearMockTimer()
        return
      }

      if (this.data.generationTaskStatus !== 'processing') {
        return
      }

      const nextProgress = Math.min(this.data.progress + generationProcessingProgressStep, generationProcessingMaxProgress)
      const activeStepIndex = Math.min(
        Math.floor((nextProgress / 100) * this.data.mock.steps.length),
        this.data.mock.steps.length - 1
      )

      this.setData({
        progress: nextProgress,
        activeStepIndex,
        canViewChapter: false,
      })
    }, 800)

    finalizeGeneratedChapterWithBackendFallback(this.data.pendingDraft, this).then((generatedChapter) => {
      if (generatedChapter && generatedChapter.id) {
        this.setData({
          generatedChapterId: generatedChapter.id,
          generationStatus: 'completed',
          progress: 100,
          canViewChapter: true,
        })
        this.clearMockTimer()
      }
    })
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
    savePendingGeneratedChapter(this.data.pendingDraft, {
      id: this.data.generationTaskId,
      status: this.data.generationTaskStatus || 'processing',
      diaryEntryId: this.data.pendingDraft && (this.data.pendingDraft.serverDiaryEntryId || this.data.pendingDraft.diaryEntryId),
      result: this.data.generationResult || {},
    })

    wx.switchTab({
      url: pageRoutes.home,
    })
  },

  async syncLoadedGenerationTask(taskId) {
    try {
      const task = await getGenerationTask(taskId)
      updateGenerationTaskState(this, task)

      if (task && isGenerationTaskFailed(task.status)) {
        enterGenerationFailedState(this, task)
        return
      }

      if (isGenerationTaskCompletedWithImage(task)) {
        const generatedChapter = finalizeGeneratedChapter(this.data.pendingDraft, task)
        this.setData({
          generatedChapterId: generatedChapter.id,
          generationStatus: 'completed',
          progress: 100,
          generationFailureTitle: '',
          generationFailureMessage: '',
          canViewChapter: true,
        })
        return
      }

      if (task && isGenerationTaskProcessing(task.status)) {
        enterGenerationProcessingState(this, task)
      }
    } catch (error) {
      return null
    }
  },

  retryGeneration() {
    clearGenerationTaskPollTimer()
    this.clearMockTimer()
    this.setData({
      progress: generationPendingProgress,
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
  buildPendingGeneratedChapter,
  savePendingGeneratedChapter,
  upsertGeneratedChapter,
  isSameGeneratedChapter,
  getDefaultPanelImages,
  buildGenerationTaskMetadata,
  getFirstGenerationImageUrl,
  normalizeGeneratedImageUrl,
  injectFirstGeneratedImage,
  waitForGenerationTaskResult,
  clearGenerationTaskPollTimer,
  enterGenerationFailedState,
  enterGenerationProcessingState,
  generationTaskPollIntervalMs,
  generationTaskMaxPollCount,
  generationFailureTitle,
  generationFailureMessage,
  generationPendingTitle,
  generationProcessingTitle,
  generationPendingProgress,
  generationProcessingMaxProgress,
  getGenerationProgressByTask,
  isGenerationTaskFailed,
  isGenerationTaskProcessing,
  isGenerationTaskCompletedWithImage,
}
