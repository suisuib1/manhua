const { createDiaryEntry, updateDiaryEntry } = require('./diaryApi')
const { storageKeys } = require('./mock')
const { getAuthToken } = require('./auth')

function mapDraftToDiaryEntryPayload(draft) {
  return {
    chapterTitle: draft.chapterTitle,
    diaryDate: draft.diaryDate,
    diaryText: draft.diaryText,
    pageCount: draft.pageCount,
    pageMode: draft.pageMode,
    selectedTags: Array.isArray(draft.selectedTags) ? draft.selectedTags : [],
    photos: mapDraftPhotos(draft),
  }
}

function mapDraftPhotos(draft) {
  if (Array.isArray(draft.photos)) {
    return draft.photos
      .filter((photo) => photo && (photo.imageUrl || photo.path))
      .slice(0, 9)
      .map((photo, index) => ({
        imageUrl: photo.imageUrl || photo.path,
        originalName: photo.originalName,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        sortOrder: Number.isInteger(photo.sortOrder) ? photo.sortOrder : index,
      }))
  }

  if (draft.photoPath) {
    return [
      {
        imageUrl: draft.photoPath,
        sortOrder: 0,
      },
    ]
  }

  return []
}

function saveLocalDraft(draft) {
  wx.setStorageSync(storageKeys.draftComicChapter, draft)
}

function saveServerDiaryEntryId(draft, serverDiaryEntryId) {
  const latestLocalDraft = wx.getStorageSync(storageKeys.draftComicChapter) || draft
  const nextDraft = Object.assign({}, latestLocalDraft, {
    serverDiaryEntryId,
  })
  saveLocalDraft(nextDraft)
  return nextDraft
}

async function syncDraftToBackend(draft) {
  const payload = mapDraftToDiaryEntryPayload(draft)

  if (draft.serverDiaryEntryId) {
    const entry = await updateDiaryEntry(draft.serverDiaryEntryId, payload)
    return entry && entry.id ? entry.id : draft.serverDiaryEntryId
  }

  const entry = await createDiaryEntry(payload)
  return entry && entry.id ? entry.id : ''
}

async function saveDraftWithBackendFallback(draft, options = {}) {
  const localDraft = wx.getStorageSync(storageKeys.draftComicChapter) || {}
  const draftToSave = !draft.serverDiaryEntryId && localDraft.serverDiaryEntryId
    ? Object.assign({}, draft, {
      serverDiaryEntryId: localDraft.serverDiaryEntryId,
    })
    : draft

  saveLocalDraft(draftToSave)

  if (!getAuthToken()) {
    return draftToSave
  }

  try {
    const serverDiaryEntryId = await syncDraftToBackend(draftToSave)
    if (!serverDiaryEntryId) {
      return draftToSave
    }

    return saveServerDiaryEntryId(draftToSave, serverDiaryEntryId)
  } catch (error) {
    if (options.showFailToast) {
      wx.showToast({
        title: '已保存到本地，登录同步失败',
        icon: 'none',
      })
    }
    return draftToSave
  }
}

module.exports = {
  mapDraftToDiaryEntryPayload,
  saveDraftWithBackendFallback,
}
