const { createDiaryEntry, updateDiaryEntry } = require('./diaryApi')
const { uploadImage } = require('./uploadApi')
const { storageKeys } = require('./mock')
const { getAuthToken } = require('./auth')

function isBackendImageUrl(filePath) {
  return typeof filePath === 'string' && (
    filePath.indexOf('/uploads/images/') === 0 ||
    /^https?:\/\/[^/]+\/uploads\/images\//.test(filePath)
  )
}

function shouldUploadPhotoPath(draft) {
  return Boolean(
    draft &&
    draft.photoPath &&
    !draft.uploadedPhotoUrl &&
    !isBackendImageUrl(draft.photoPath)
  )
}

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
        imageUrl: draft.uploadedPhotoUrl || draft.photoPath,
        sortOrder: 0,
      },
    ]
  }

  return []
}

function saveLocalDraft(draft) {
  wx.setStorageSync(storageKeys.draftComicChapter, draft)
}

function clearCreateDraftAfterGeneration() {
  wx.removeStorageSync(storageKeys.draftComicChapter)
  wx.setStorageSync(storageKeys.createDraftResetAfterGeneration, true)
}

function consumeCreateDraftResetAfterGeneration() {
  const shouldReset = Boolean(wx.getStorageSync(storageKeys.createDraftResetAfterGeneration))

  if (shouldReset) {
    wx.removeStorageSync(storageKeys.createDraftResetAfterGeneration)
  }

  return shouldReset
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
  const draftForSync = await prepareDraftForBackendSync(draft)
  const payload = mapDraftToDiaryEntryPayload(draftForSync)

  if (draftForSync.serverDiaryEntryId) {
    const entry = await updateDiaryEntry(draftForSync.serverDiaryEntryId, payload)
    return {
      serverDiaryEntryId: entry && entry.id ? entry.id : draftForSync.serverDiaryEntryId,
      draftForSync,
    }
  }

  const entry = await createDiaryEntry(payload)
  return {
    serverDiaryEntryId: entry && entry.id ? entry.id : '',
    draftForSync,
  }
}

async function prepareDraftForBackendSync(draft) {
  if (!shouldUploadPhotoPath(draft)) {
    return draft
  }

  try {
    const uploadedPhoto = await uploadImage(draft.photoPath)

    if (!uploadedPhoto || !uploadedPhoto.url) {
      return draft
    }

    const draftWithUploadedPhoto = Object.assign({}, draft, {
      uploadedPhotoUrl: uploadedPhoto.url,
    })

    saveLocalDraft(draftWithUploadedPhoto)
    return draftWithUploadedPhoto
  } catch (error) {
    return draft
  }
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
    const syncResult = await syncDraftToBackend(draftToSave)
    const serverDiaryEntryId = syncResult.serverDiaryEntryId
    const syncedDraft = syncResult.draftForSync || draftToSave
    if (!serverDiaryEntryId) {
      return syncedDraft
    }

    return saveServerDiaryEntryId(syncedDraft, serverDiaryEntryId)
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
  prepareDraftForBackendSync,
  saveDraftWithBackendFallback,
  clearCreateDraftAfterGeneration,
  consumeCreateDraftResetAfterGeneration,
}
