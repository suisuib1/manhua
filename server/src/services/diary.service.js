const { prisma } = require('../utils/prisma')

async function createEntry(ownerUserId, input) {
  const data = normalizeEntryInput(input, { partial: false })
  const photos = normalizePhotos(input.photos, { required: false })

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.diaryEntry.create({
      data: {
        ownerUserId,
        chapterTitle: data.chapterTitle,
        diaryDate: data.diaryDate,
        diaryText: data.diaryText,
        pageCount: data.pageCount,
        pageMode: data.pageMode,
        selectedTagsJson: data.selectedTagsJson,
        status: 'draft',
      },
    })

    if (photos.length > 0) {
      await tx.diaryPhoto.createMany({
        data: photos.map((photo) => ({
          diaryEntryId: created.id,
          ownerUserId,
          ...photo,
        })),
      })
    }

    return tx.diaryEntry.findFirst({
      where: {
        id: created.id,
        ownerUserId,
        deletedAt: null,
      },
      include: activePhotosInclude(),
    })
  })

  return formatEntry(entry)
}

async function listEntries(ownerUserId, query) {
  const status = typeof query.status === 'string' && query.status ? query.status : 'draft'
  const page = normalizePositiveInt(query.page, 1)
  const pageSize = Math.min(normalizePositiveInt(query.pageSize, 20), 50)
  const skip = (page - 1) * pageSize
  const where = {
    ownerUserId,
    status,
    deletedAt: null,
  }

  const [items, total] = await prisma.$transaction([
    prisma.diaryEntry.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
      include: activePhotosInclude(),
    }),
    prisma.diaryEntry.count({ where }),
  ])

  return {
    items: items.map(formatEntry),
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

async function getEntryById(ownerUserId, id) {
  const entry = await findOwnedEntry(ownerUserId, id)
  return formatEntry(entry)
}

async function updateEntry(ownerUserId, id, input) {
  const data = normalizeEntryInput(input, { partial: true })
  const shouldReplacePhotos = Object.prototype.hasOwnProperty.call(input, 'photos')
  const photos = shouldReplacePhotos ? normalizePhotos(input.photos, { required: true }) : []

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.diaryEntry.findFirst({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
    })

    if (!existing) {
      throwNotFound()
    }

    const updated = await tx.diaryEntry.update({
      where: {
        id: existing.id,
      },
      data,
    })

    if (shouldReplacePhotos) {
      const now = new Date()
      await tx.diaryPhoto.updateMany({
        where: {
          diaryEntryId: updated.id,
          ownerUserId,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
        },
      })

      if (photos.length > 0) {
        await tx.diaryPhoto.createMany({
          data: photos.map((photo) => ({
            diaryEntryId: updated.id,
            ownerUserId,
            ...photo,
          })),
        })
      }
    }

    return tx.diaryEntry.findFirst({
      where: {
        id: updated.id,
        ownerUserId,
        deletedAt: null,
      },
      include: activePhotosInclude(),
    })
  })

  return formatEntry(entry)
}

async function softDeleteEntry(ownerUserId, id) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.diaryEntry.findFirst({
      where: {
        id,
        ownerUserId,
        deletedAt: null,
      },
    })

    if (!existing) {
      throwNotFound()
    }

    const now = new Date()
    await tx.diaryEntry.update({
      where: {
        id: existing.id,
      },
      data: {
        deletedAt: now,
      },
    })
    await tx.diaryPhoto.updateMany({
      where: {
        diaryEntryId: existing.id,
        ownerUserId,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    })
  })

  return {
    deleted: true,
  }
}

async function findOwnedEntry(ownerUserId, id) {
  const entry = await prisma.diaryEntry.findFirst({
    where: {
      id,
      ownerUserId,
      deletedAt: null,
    },
    include: activePhotosInclude(),
  })

  if (!entry) {
    throwNotFound()
  }

  return entry
}

function normalizeEntryInput(input, options) {
  const data = {}

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'chapterTitle')) {
    data.chapterTitle = assertOptionalString(input.chapterTitle, 80, '章节标题最长 80 个字符')
  }

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'diaryDate')) {
    data.diaryDate = normalizeDate(input.diaryDate)
  }

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'diaryText')) {
    data.diaryText = assertOptionalString(input.diaryText, 5000, '日记正文最长 5000 个字符')
  }

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'pageCount')) {
    data.pageCount = normalizePageCount(input.pageCount)
  }

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'pageMode')) {
    data.pageMode = assertOptionalString(input.pageMode, 30, '页面模式最长 30 个字符')
  }

  if (!options.partial || Object.prototype.hasOwnProperty.call(input, 'selectedTags')) {
    data.selectedTagsJson = JSON.stringify(normalizeSelectedTags(input.selectedTags))
  }

  if (options.partial) {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    )
  }

  return data
}

function normalizePhotos(photos, options) {
  if (photos === undefined || photos === null) {
    if (options.required) {
      return []
    }
    return []
  }

  if (!Array.isArray(photos)) {
    throwBadRequest('照片必须是数组')
  }

  if (photos.length > 9) {
    throwBadRequest('照片最多 9 张')
  }

  return photos.map((photo) => {
    if (!photo || typeof photo !== 'object' || Array.isArray(photo)) {
      throwBadRequest('照片格式不正确')
    }

    return {
      imageUrl: assertRequiredString(photo.imageUrl, 1000, '照片地址不能为空'),
      originalName: assertOptionalString(photo.originalName, 255, '照片文件名最长 255 个字符'),
      mimeType: assertOptionalString(photo.mimeType, 100, '照片类型最长 100 个字符'),
      sizeBytes: normalizeNonNegativeInt(photo.sizeBytes, '照片大小必须是非负整数'),
      sortOrder: normalizeNonNegativeInt(photo.sortOrder, '照片排序必须是非负整数') || 0,
    }
  })
}

function normalizeSelectedTags(selectedTags) {
  if (selectedTags === undefined || selectedTags === null) {
    return []
  }

  if (!Array.isArray(selectedTags)) {
    throwBadRequest('标签必须是数组')
  }

  if (selectedTags.length > 20) {
    throwBadRequest('标签最多 20 个')
  }

  return selectedTags.map((tag) => assertRequiredString(tag, 20, '标签最长 20 个字符'))
}

function normalizePageCount(pageCount) {
  if (pageCount === undefined || pageCount === null) {
    return 4
  }

  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) {
    throwBadRequest('页数必须是 1 到 20 的整数')
  }

  return pageCount
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throwBadRequest('日记日期格式不正确')
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throwBadRequest('日记日期格式不正确')
  }

  return date
}

function normalizePositiveInt(value, fallback) {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return fallback
  }
  return numberValue
}

function normalizeNonNegativeInt(value, message) {
  if (value === undefined || value === null) {
    return null
  }

  if (!Number.isInteger(value) || value < 0) {
    throwBadRequest(message)
  }

  return value
}

function assertOptionalString(value, maxLength, message) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throwBadRequest('字段格式不正确')
  }

  if (value.length > maxLength) {
    throwBadRequest(message)
  }

  return value
}

function assertRequiredString(value, maxLength, message) {
  if (typeof value !== 'string' || value.length === 0) {
    throwBadRequest(message)
  }

  if (value.length > maxLength) {
    throwBadRequest(message)
  }

  return value
}

function activePhotosInclude() {
  return {
    photos: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    },
  }
}

function formatEntry(entry) {
  return {
    id: entry.id,
    chapterTitle: entry.chapterTitle,
    diaryDate: entry.diaryDate ? entry.diaryDate.toISOString() : null,
    diaryText: entry.diaryText,
    pageCount: entry.pageCount,
    pageMode: entry.pageMode,
    selectedTags: parseSelectedTags(entry.selectedTagsJson),
    status: entry.status,
    photos: entry.photos.map(formatPhoto),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function formatPhoto(photo) {
  return {
    id: photo.id,
    imageUrl: photo.imageUrl,
    originalName: photo.originalName,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    sortOrder: photo.sortOrder,
  }
}

function parseSelectedTags(selectedTagsJson) {
  try {
    const tags = JSON.parse(selectedTagsJson || '[]')
    return Array.isArray(tags) ? tags : []
  } catch (err) {
    return []
  }
}

function throwBadRequest(message) {
  const error = new Error(message)
  error.status = 400
  error.code = 40001
  throw error
}

function throwNotFound() {
  const error = new Error('日记草稿不存在')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  createEntry,
  listEntries,
  getEntryById,
  updateEntry,
  softDeleteEntry,
}
