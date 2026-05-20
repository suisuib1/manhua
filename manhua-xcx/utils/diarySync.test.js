const assert = require('node:assert/strict')
const test = require('node:test')

function loadSync(storage = {}, requestImpl, uploadImpl) {
  const requestCalls = []
  const uploadCalls = []
  const toastCalls = []

  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    setStorageSync(key, value) {
      storage[key] = value
    },
    request(options) {
      requestCalls.push(options)
      requestImpl(options)
    },
    uploadFile(options) {
      uploadCalls.push(options)
      const handler = uploadImpl || ((uploadOptions) => {
        uploadOptions.success({
          statusCode: 200,
          data: JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              url: '/uploads/images/test-upload.jpg',
              filename: 'test-upload.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 123,
            },
          }),
        })
      })
      handler(options)
    },
    showToast(options) {
      toastCalls.push(options)
    },
  }

  delete require.cache[require.resolve('./api')]
  delete require.cache[require.resolve('./diaryApi')]
  delete require.cache[require.resolve('./diarySync')]
  const diarySync = require('./diarySync')

  return {
    diarySync,
    requestCalls,
    uploadCalls,
    toastCalls,
    storage,
  }
}

test('有 token 且没有 serverDiaryEntryId 时同步草稿会 POST 并写回后端 id', async () => {
  const storage = {
    authToken: 'token-issue8',
  }
  const { diarySync, requestCalls } = loadSync(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-issue8',
          chapterTitle: '今天的小确幸',
          photos: [{ imageUrl: 'wxfile://tmp.jpg' }],
        },
      },
    })
  })

  const draft = await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '今天的小确幸',
    diaryDate: '2026-05-20',
    diaryText: '今天和朋友一起散步。',
    pageCount: 4,
    pageMode: 'continuous',
    selectedTags: ['开心', '日常'],
    photoPath: 'wxfile://tmp.jpg',
  })

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries')
  assert.equal(requestCalls[0].method, 'POST')
  assert.equal(requestCalls[0].header.Authorization, 'Bearer token-issue8')
  assert.equal(requestCalls[0].data.photos[0].imageUrl, '/uploads/images/test-upload.jpg')
  assert.equal(draft.serverDiaryEntryId, 'entry-issue8')
  assert.equal(storage.draftComicChapter.serverDiaryEntryId, 'entry-issue8')
  assert.equal(storage.draftComicChapter.photoPath, 'wxfile://tmp.jpg')
})

test('有 token 且存在 serverDiaryEntryId 时同步草稿会 PUT', async () => {
  const { diarySync, requestCalls } = loadSync({ authToken: 'token-issue8' }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-existing',
        },
      },
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    serverDiaryEntryId: 'entry-existing',
    chapterTitle: '更新标题',
    selectedTags: [],
  })

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries/entry-existing')
  assert.equal(requestCalls[0].method, 'PUT')
})

test('本地已有 serverDiaryEntryId 时后续完整草稿会复用后端草稿 id', async () => {
  const { diarySync, requestCalls, storage } = loadSync({
    authToken: 'token-issue8',
    draftComicChapter: {
      serverDiaryEntryId: 'entry-from-create',
      chapterTitle: '创建页草稿',
    },
  }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-from-create',
        },
      },
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '完整日记草稿',
    diaryText: '补充正文',
  })

  assert.equal(requestCalls[0].url, 'http://127.0.0.1:3000/api/diary-entries/entry-from-create')
  assert.equal(requestCalls[0].method, 'PUT')
  assert.equal(storage.draftComicChapter.serverDiaryEntryId, 'entry-from-create')
  assert.equal(storage.draftComicChapter.diaryText, '补充正文')
})

test('无 token 时只保存本地草稿且不调用后端', async () => {
  const { diarySync, requestCalls, uploadCalls, storage } = loadSync({}, () => {
    throw new Error('不应调用后端')
  })

  const draft = await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '本地草稿',
    photoPath: 'wxfile://local.jpg',
  })

  assert.equal(requestCalls.length, 0)
  assert.equal(uploadCalls.length, 0)
  assert.equal(draft.serverDiaryEntryId, undefined)
  assert.equal(storage.draftComicChapter.chapterTitle, '本地草稿')
})

test('后端同步失败时保留本地草稿并不修改生成章节缓存', async () => {
  const storage = {
    authToken: 'token-issue8',
    generatedComicChapters: [{ id: 'chapter-1' }],
  }
  const { diarySync, storage: nextStorage, toastCalls } = loadSync(storage, (options) => {
    options.success({
      statusCode: 500,
      data: {
        code: 500,
        message: 'server error',
        data: null,
      },
    })
  })

  const draft = await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '失败也保留',
    diaryText: '不要阻塞本地流程',
  }, {
    showFailToast: true,
  })

  assert.equal(draft.chapterTitle, '失败也保留')
  assert.equal(nextStorage.draftComicChapter.diaryText, '不要阻塞本地流程')
  assert.deepEqual(nextStorage.generatedComicChapters, [{ id: 'chapter-1' }])
  assert.equal(toastCalls[0].title, '已保存到本地，登录同步失败')
})

test('后端同步成功回写 id 时不会覆盖当前更完整的本地草稿', async () => {
  const storage = {
    authToken: 'token-issue8',
  }
  const { diarySync, storage: nextStorage } = loadSync(storage, (options) => {
    nextStorage.draftComicChapter = {
      chapterTitle: '完整日记草稿',
      diaryText: '日记页已经补充的正文',
      photoPath: 'wxfile://full.jpg',
    }
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-late-sync',
        },
      },
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '创建页草稿',
  })

  assert.equal(nextStorage.draftComicChapter.serverDiaryEntryId, 'entry-late-sync')
  assert.equal(nextStorage.draftComicChapter.chapterTitle, '完整日记草稿')
  assert.equal(nextStorage.draftComicChapter.diaryText, '日记页已经补充的正文')
  assert.equal(nextStorage.draftComicChapter.photoPath, 'wxfile://full.jpg')
})

test('后端请求失败时本地创建日记流程仍保留草稿', async () => {
  const storage = {
    authToken: 'token-issue8',
  }
  const { diarySync, requestCalls, storage: nextStorage } = loadSync(storage, (options) => {
    options.fail({
      errMsg: 'request:fail url not in domain list',
    })
  })

  const draft = await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '登录接口未配置时的本地草稿',
    diaryText: '请求失败也不影响本地创建',
  })

  assert.equal(requestCalls.length, 1)
  assert.equal(draft.serverDiaryEntryId, undefined)
  assert.equal(nextStorage.draftComicChapter.chapterTitle, '登录接口未配置时的本地草稿')
  assert.equal(nextStorage.draftComicChapter.diaryText, '请求失败也不影响本地创建')
})

test('单图 photoPath 会映射为后端 photos[0].imageUrl', () => {
  const { diarySync } = loadSync({}, () => {})
  const payload = diarySync.mapDraftToDiaryEntryPayload({
    chapterTitle: '带图草稿',
    selectedTags: ['开心'],
    photoPath: 'wxfile://one.jpg',
  })

  assert.deepEqual(payload.photos, [
    {
      imageUrl: 'wxfile://one.jpg',
      sortOrder: 0,
    },
  ])
})

test('有 token 且本地 photoPath 时先上传图片再同步后端草稿', async () => {
  const storage = {
    authToken: 'token-upload',
  }
  const { diarySync, requestCalls, uploadCalls, storage: nextStorage } = loadSync(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-uploaded',
        },
      },
    })
  }, (options) => {
    options.success({
      statusCode: 200,
      data: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          url: '/uploads/images/photo-uploaded.jpg',
          filename: 'photo-uploaded.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 456,
        },
      }),
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '上传照片',
    photoPath: 'wxfile://local-photo.jpg',
  })

  assert.equal(uploadCalls.length, 1)
  assert.equal(uploadCalls[0].url, 'http://127.0.0.1:3000/api/uploads/images')
  assert.equal(uploadCalls[0].filePath, 'wxfile://local-photo.jpg')
  assert.equal(uploadCalls[0].name, 'file')
  assert.equal(uploadCalls[0].header.Authorization, 'Bearer token-upload')
  assert.equal(requestCalls[0].data.photos[0].imageUrl, '/uploads/images/photo-uploaded.jpg')
  assert.equal(nextStorage.draftComicChapter.photoPath, 'wxfile://local-photo.jpg')
  assert.equal(nextStorage.draftComicChapter.uploadedPhotoUrl, '/uploads/images/photo-uploaded.jpg')
})

test('已有 uploadedPhotoUrl 时不重复上传并优先同步上传后的 URL', async () => {
  const { diarySync, requestCalls, uploadCalls } = loadSync({ authToken: 'token-upload' }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-existing-upload',
        },
      },
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '已有上传',
    photoPath: 'wxfile://local-photo.jpg',
    uploadedPhotoUrl: '/uploads/images/existing.jpg',
  })

  assert.equal(uploadCalls.length, 0)
  assert.equal(requestCalls[0].data.photos[0].imageUrl, '/uploads/images/existing.jpg')
})

test('后端 URL 不重复上传', async () => {
  const { diarySync, requestCalls, uploadCalls } = loadSync({ authToken: 'token-upload' }, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-server-url',
        },
      },
    })
  })

  await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '后端 URL',
    photoPath: '/uploads/images/server.jpg',
  })

  assert.equal(uploadCalls.length, 0)
  assert.equal(requestCalls[0].data.photos[0].imageUrl, '/uploads/images/server.jpg')
})

test('上传失败时保留本地草稿且不删除生成章节缓存', async () => {
  const storage = {
    authToken: 'token-upload',
    generatedComicChapters: [{ id: 'chapter-1' }],
  }
  const { diarySync, requestCalls, uploadCalls, storage: nextStorage } = loadSync(storage, (options) => {
    options.success({
      statusCode: 200,
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 'entry-upload-fallback',
        },
      },
    })
  }, (options) => {
    options.fail({
      errMsg: 'uploadFile:fail',
    })
  })

  const draft = await diarySync.saveDraftWithBackendFallback({
    chapterTitle: '上传失败兜底',
    photoPath: 'wxfile://local-fail.jpg',
  })

  assert.equal(uploadCalls.length, 1)
  assert.equal(requestCalls[0].data.photos[0].imageUrl, 'wxfile://local-fail.jpg')
  assert.equal(draft.photoPath, 'wxfile://local-fail.jpg')
  assert.equal(nextStorage.draftComicChapter.photoPath, 'wxfile://local-fail.jpg')
  assert.deepEqual(nextStorage.generatedComicChapters, [{ id: 'chapter-1' }])
})
