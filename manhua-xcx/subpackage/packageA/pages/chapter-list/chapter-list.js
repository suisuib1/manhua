const { pageRoutes, storageKeys } = require('../../../../utils/mock')
const { getAuthToken } = require('../../../../utils/auth')
const { getRecentComicChapters } = require('../../../../utils/comicChapterApi')
const {
  buildChapterList,
  buildReadableChapters,
  getChapterStatus,
  isTaskInProgress,
  loadStoredChapters,
  mergeRealAndLocalChapters,
} = require('../../../../utils/chapterCatalog')

const chapterListRecentLimit = 50

function saveChapterAsPendingDraft(chapter) {
  if (!chapter) {
    return
  }

  wx.setStorageSync(storageKeys.draftComicChapter, Object.assign({}, chapter, {
    chapterTitle: chapter.title,
    serverDiaryEntryId: chapter.diaryEntryId || chapter.serverDiaryEntryId || chapter.id,
    generationTaskId: chapter.generationTaskId,
    generationTaskStatus: getChapterStatus(chapter),
    generationResult: chapter.generationResult || {},
  }))
}

function saveReaderChapter(chapter) {
  if (!chapter || !chapter.id) {
    return
  }

  const chapters = wx.getStorageSync(storageKeys.generatedComicChapters) || []
  const nextChapters = [chapter].concat(chapters.filter((item) => {
    return item.id !== chapter.id && item.diaryEntryId !== chapter.id
  }))

  wx.setStorageSync(storageKeys.generatedComicChapters, nextChapters)
}

Page({
  data: {
    chapters: [],
    hasChapters: false,
  },

  async onLoad() {
    if (!getAuthToken()) {
      this.setData({
        chapters: [],
        hasChapters: false,
      })
      return null
    }

    try {
      const data = await getRecentComicChapters({ limit: chapterListRecentLimit })
      const realChapters = data && Array.isArray(data.items) ? data.items : []
      const chapters = mergeRealAndLocalChapters(realChapters, loadStoredChapters())

      this.setData({
        chapters,
        hasChapters: chapters.length > 0,
      })

      return data
    } catch (error) {
      this.setData({
        chapters: [],
        hasChapters: false,
      })
      return null
    }
  },

  openChapter(event) {
    const { chapterId } = event.currentTarget.dataset

    if (!chapterId) return

    const chapter = this.data.chapters.find((item) => item.id === chapterId || item.diaryEntryId === chapterId)
    const status = getChapterStatus(chapter)

    if (chapter && (isTaskInProgress(status) || status === 'failed')) {
      saveChapterAsPendingDraft(chapter)
      wx.navigateTo({
        url: `${pageRoutes.generating}?taskId=${chapter.generationTaskId || ''}&taskStatus=${status}`,
      })
      return
    }

    if (chapter) {
      saveReaderChapter(chapter)
    }

    wx.navigateTo({
      url: `${pageRoutes.continuousChapter}?chapterId=${chapterId}`,
    })
  },

  goCreateChapter() {
    wx.switchTab({
      url: pageRoutes.create,
    })
  },
})

module.exports = {
  buildChapterList,
  buildReadableChapters,
  chapterListRecentLimit,
  saveChapterAsPendingDraft,
  saveReaderChapter,
}
