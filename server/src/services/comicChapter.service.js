const { prisma } = require('../utils/prisma')

const defaultLimit = 5
const maxLimit = 20

async function listRecentChapters(ownerUserId, query) {
  const limit = normalizeLimit(query.limit)
  const tasks = await prisma.generationTask.findMany({
    where: {
      ownerUserId,
      deletedAt: null,
      diaryEntry: {
        ownerUserId,
        deletedAt: null,
      },
    },
    orderBy: [
      {
        createdAt: 'desc',
      },
      {
        diaryEntry: {
          createdAt: 'desc',
        },
      },
    ],
    include: {
      diaryEntry: {
        include: {
          photos: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      },
    },
  })

  const items = []
  const seenDiaryEntryIds = new Set()

  for (const task of tasks) {
    if (!task.diaryEntry || seenDiaryEntryIds.has(task.diaryEntry.id)) {
      continue
    }

    seenDiaryEntryIds.add(task.diaryEntry.id)
    items.push(formatRecentChapter(task))

    if (items.length >= limit) {
      break
    }
  }

  return {
    items,
  }
}

function normalizeLimit(value) {
  const numberValue = Number(value)

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return defaultLimit
  }

  return Math.min(numberValue, maxLimit)
}

function formatRecentChapter(task) {
  const diaryEntry = task.diaryEntry
  const result = parseJsonObject(task.resultJson)
  const pages = Array.isArray(result.pages) ? result.pages : []
  const firstPage = pages[0] || {}
  const firstComicImageUrl = findFirstComicImageUrl(pages)
  const firstPhoto = Array.isArray(diaryEntry.photos) ? diaryEntry.photos[0] : null
  const date = diaryEntry.diaryDate
    || normalizeDate(result.chapter && result.chapter.date)
    || diaryEntry.createdAt

  return {
    id: diaryEntry.id,
    diaryEntryId: diaryEntry.id,
    generationTaskId: task.id,
    title: diaryEntry.chapterTitle || (result.chapter && result.chapter.title) || '未命名章节',
    date: date ? date.toISOString() : null,
    summary: firstPage.caption || summarizeDiaryText(diaryEntry.diaryText),
    status: task.status,
    pageCount: pages.length || diaryEntry.pageCount || 0,
    coverImageUrl: firstComicImageUrl || (firstPhoto && firstPhoto.imageUrl) || null,
    hasComicImages: Boolean(firstComicImageUrl),
    createdAt: (task.createdAt || diaryEntry.createdAt).toISOString(),
  }
}

function findFirstComicImageUrl(pages) {
  for (const page of pages) {
    if (page && typeof page.imageUrl === 'string' && page.imageUrl) {
      return page.imageUrl
    }
  }

  return ''
}

function summarizeDiaryText(value) {
  if (!value) return ''
  return String(value).slice(0, 24)
}

function normalizeDate(value) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (err) {
    return {}
  }
}

module.exports = {
  listRecentChapters,
}
