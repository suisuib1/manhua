const { prisma } = require('../utils/prisma')

const allowedStatuses = new Set(['pending', 'processing', 'completed', 'failed', 'no_task'])
const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

async function listAdminComicChapters(query) {
  const page = normalizePositiveInt(query.page, defaultPage)
  const pageSize = Math.min(normalizePositiveInt(query.pageSize, defaultPageSize), maxPageSize)
  const entries = await prisma.diaryEntry.findMany({
    where: buildDiaryWhere(query),
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
      generationTasks: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  const filtered = entries
    .map(formatChapterForList)
    .filter((item) => matchesStatus(item, query.status))
    .sort(compareChapterListItems)

  const total = filtered.length
  const start = (page - 1) * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

async function getAdminComicChapterDetail(diaryEntryId) {
  const entry = await prisma.diaryEntry.findFirst({
    where: {
      id: diaryEntryId,
      deletedAt: null,
    },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
      generationTasks: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!entry) {
    throwNotFound()
  }

  return formatChapterDetail(entry)
}

function buildDiaryWhere(query) {
  const where = {
    deletedAt: null,
  }
  const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : ''
  const createdAt = buildDateRange(query.dateFrom, query.dateTo)

  if (createdAt) {
    where.createdAt = createdAt
  }

  if (keyword) {
    where.OR = [
      {
        id: {
          contains: keyword,
        },
      },
      {
        ownerUserId: {
          contains: keyword,
        },
      },
      {
        chapterTitle: {
          contains: keyword,
        },
      },
      {
        generationTasks: {
          some: {
            id: {
              contains: keyword,
            },
          },
        },
      },
    ]
  }

  return where
}

function buildDateRange(dateFrom, dateTo) {
  const range = {}
  const from = parseDate(dateFrom, { endOfDay: false })
  const to = parseDate(dateTo, { endOfDay: true })

  if (from) {
    range.gte = from
  }

  if (to) {
    range.lte = to
  }

  return Object.keys(range).length > 0 ? range : null
}

function parseDate(value, options) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  if (!text) {
    return null
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T${options.endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(text)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatChapterForList(entry) {
  const latestTask = entry.generationTasks[0] || null
  const imageUrl = latestTask ? findFirstImageUrl(parseJsonObject(latestTask.resultJson)) : ''
  const selectedTags = parseJsonArray(entry.selectedTagsJson)

  return {
    diaryEntryId: entry.id,
    ownerUserId: entry.ownerUserId,
    title: entry.chapterTitle || '',
    date: entry.diaryDate ? entry.diaryDate.toISOString() : null,
    mood: selectedTags[0] || '',
    summary: summarize(entry.diaryText, 80),
    status: latestTask ? latestTask.status : 'no_task',
    generationTaskId: latestTask ? latestTask.id : null,
    hasImage: Boolean(imageUrl),
    coverImageUrl: imageUrl || null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    taskCreatedAt: latestTask ? latestTask.createdAt.toISOString() : null,
    taskFinishedAt: latestTask && latestTask.finishedAt ? latestTask.finishedAt.toISOString() : null,
    userNickname: entry.owner && entry.owner.profile ? entry.owner.profile.nickname || '' : '',
  }
}

function formatChapterDetail(entry) {
  const latestTask = entry.generationTasks[0] || null
  const selectedTags = parseJsonArray(entry.selectedTagsJson)

  return {
    diary: {
      id: entry.id,
      ownerUserId: entry.ownerUserId,
      title: entry.chapterTitle || '',
      content: entry.diaryText || '',
      mood: selectedTags[0] || '',
      date: entry.diaryDate ? entry.diaryDate.toISOString() : null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    },
    user: {
      id: entry.owner.id,
      nickname: entry.owner.profile ? entry.owner.profile.nickname || '' : '',
    },
    latestTask: latestTask ? formatLatestTask(latestTask) : null,
    taskHistory: entry.generationTasks.map(formatTaskHistoryItem),
  }
}

function formatLatestTask(task) {
  const imageUrl = findFirstImageUrl(parseJsonObject(task.resultJson))

  return {
    id: task.id,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    errorMessage: summarize(task.errorMessage, 300),
    hasImage: Boolean(imageUrl),
    imageUrl: imageUrl || null,
  }
}

function formatTaskHistoryItem(task) {
  const imageUrl = findFirstImageUrl(parseJsonObject(task.resultJson))

  return {
    id: task.id,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    hasImage: Boolean(imageUrl),
  }
}

function matchesStatus(item, status) {
  const normalized = typeof status === 'string' ? status.trim() : ''
  if (!allowedStatuses.has(normalized)) {
    return true
  }

  return item.status === normalized
}

function compareChapterListItems(a, b) {
  const aTime = new Date(a.taskCreatedAt || a.createdAt).getTime()
  const bTime = new Date(b.taskCreatedAt || b.createdAt).getTime()
  return bTime - aTime
}

function findFirstImageUrl(result) {
  const pages = Array.isArray(result.pages) ? result.pages : []
  for (const page of pages) {
    if (page && typeof page.imageUrl === 'string' && page.imageUrl) {
      return page.imageUrl
    }
  }

  return ''
}

function summarize(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (err) {
    return {}
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    return []
  }
}

function normalizePositiveInt(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback
}

function throwNotFound() {
  const error = new Error('Comic chapter not found')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  getAdminComicChapterDetail,
  listAdminComicChapters,
}
