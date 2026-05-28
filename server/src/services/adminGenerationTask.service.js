const path = require('node:path')
const { prisma } = require('../utils/prisma')

const allowedStatuses = new Set(['pending', 'processing', 'completed', 'failed'])
const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

async function listAdminGenerationTasks(query) {
  const page = normalizePositiveInt(query.page, defaultPage)
  const pageSize = Math.min(normalizePositiveInt(query.pageSize, defaultPageSize), maxPageSize)
  const where = buildListWhere(query)

  const [items, total] = await prisma.$transaction([
    prisma.generationTask.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: taskInclude(),
    }),
    prisma.generationTask.count({ where }),
  ])

  return {
    items: items.map(formatTaskSummary),
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

async function getAdminGenerationTaskDetail(id) {
  const task = await prisma.generationTask.findUnique({
    where: {
      id,
    },
    include: taskInclude(),
  })

  if (!task) {
    throwNotFound()
  }

  return formatTaskDetail(task)
}

function buildListWhere(query) {
  const where = {}
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : ''
  const createdAt = buildDateRange(query.dateFrom, query.dateTo)

  if (allowedStatuses.has(status)) {
    where.status = status
  }

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
        diaryEntryId: {
          contains: keyword,
        },
      },
      {
        ownerUserId: {
          contains: keyword,
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

function taskInclude() {
  return {
    owner: {
      include: {
        profile: true,
      },
    },
    diaryEntry: true,
  }
}

function formatTaskSummary(task) {
  const result = parseJsonObject(task.resultJson)
  const imageUrl = findFirstImageUrl(result)

  return {
    id: task.id,
    diaryEntryId: task.diaryEntryId,
    ownerUserId: task.ownerUserId,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    durationMs: calculateDurationMs(task),
    errorMessage: summarize(task.errorMessage, 120),
    hasImage: Boolean(imageUrl),
    imageUrl: imageUrl || null,
    diaryTitle: task.diaryEntry ? task.diaryEntry.chapterTitle || '' : '',
    userNickname: task.owner && task.owner.profile ? task.owner.profile.nickname || '' : '',
  }
}

function formatTaskDetail(task) {
  const input = sanitizeJsonValue(parseJsonObject(task.inputJson))
  const result = sanitizeJsonValue(parseJsonObject(task.resultJson))

  return {
    id: task.id,
    diaryEntryId: task.diaryEntryId,
    ownerUserId: task.ownerUserId,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    durationMs: calculateDurationMs(task),
    errorMessage: sanitizeSummary(task.errorMessage, 300),
    input,
    result,
    promptSnapshot: sanitizePrompt(task.promptSnapshot),
    diary: formatDiary(task.diaryEntry),
    user: formatUser(task.owner),
  }
}

function formatDiary(diaryEntry) {
  if (!diaryEntry) {
    return null
  }

  const selectedTags = parseJsonArray(diaryEntry.selectedTagsJson)

  return {
    id: diaryEntry.id,
    title: diaryEntry.chapterTitle || '',
    content: summarize(diaryEntry.diaryText, 160),
    mood: selectedTags[0] || '',
    date: diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString() : null,
  }
}

function formatUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    nickname: user.profile ? user.profile.nickname || '' : '',
  }
}

function findFirstImageUrl(result) {
  if (!result || typeof result !== 'object') {
    return ''
  }

  const pages = Array.isArray(result.pages) ? result.pages : []
  for (const page of pages) {
    if (page && typeof page.imageUrl === 'string' && page.imageUrl) {
      return page.imageUrl
    }
  }

  return ''
}

function calculateDurationMs(task) {
  const start = task.startedAt || task.createdAt
  const end = task.finishedAt

  if (!start || !end) {
    return null
  }

  const duration = end.getTime() - start.getTime()
  return duration >= 0 ? duration : null
}

function sanitizePrompt(value) {
  return sanitizeSummary(value, 4000)
}

function sanitizeJsonValue(value) {
  if (typeof value === 'string') {
    return sanitizeSensitiveText(value)
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item)])
    )
  }

  return value
}

function sanitizeSummary(value, maxLength) {
  return sanitizeSensitiveText(summarize(value, maxLength))
}

function sanitizeSensitiveText(value) {
  let text = String(value || '')
  text = text
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/OPENAI_API_KEY/gi, '[redacted-env]')
    .replace(/Authorization/gi, '[redacted-header]')

  const cwd = process.cwd()
  text = replaceAllText(text, cwd, '[redacted-path]')
  text = replaceAllText(text, cwd.replace(/\\/g, '/'), '[redacted-path]')
  text = replaceAllText(text, path.resolve(__dirname, '..', '..'), '[redacted-path]')

  return text
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

function replaceAllText(value, search, replacement) {
  if (!search) return value
  return value.split(search).join(replacement)
}

function normalizePositiveInt(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback
}

function throwNotFound() {
  const error = new Error('Generation task not found')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  getAdminGenerationTaskDetail,
  listAdminGenerationTasks,
}
