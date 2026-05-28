const { prisma } = require('../utils/prisma')

const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

async function listAdminUsers(query) {
  const page = normalizePositiveInt(query.page, defaultPage)
  const pageSize = Math.min(normalizePositiveInt(query.pageSize, defaultPageSize), maxPageSize)
  const where = buildUserWhere(query)

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: userInclude(),
    }),
    prisma.user.count({ where }),
  ])

  return {
    items: users.map(formatUserSummary),
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

async function getAdminUserDetail(id) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    include: userInclude(),
  })

  if (!user) {
    throwNotFound()
  }

  return formatUserDetail(user)
}

function buildUserWhere(query) {
  const where = {}
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
        wxOpenid: {
          contains: keyword,
        },
      },
      {
        profile: {
          nickname: {
            contains: keyword,
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

function userInclude() {
  return {
    profile: true,
    characterProfile: true,
    diaryEntries: {
      where: {
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
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
  }
}

function formatUserSummary(user) {
  const stats = buildUserStats(user)

  return {
    id: user.id,
    nickname: user.profile ? user.profile.nickname || '' : '',
    avatarUrl: user.profile ? user.profile.avatarUrl || '' : '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    diaryEntryCount: stats.diaryEntryCount,
    generationTaskCount: stats.generationTaskCount,
    completedChapterCount: stats.completedChapterCount,
    generatingTaskCount: stats.generatingTaskCount,
    failedTaskCount: stats.failedTaskCount,
    hasCharacterProfile: Boolean(user.characterProfile),
    latestDiaryAt: user.diaryEntries[0] ? user.diaryEntries[0].createdAt.toISOString() : null,
    latestGenerationTaskAt: user.generationTasks[0] ? user.generationTasks[0].createdAt.toISOString() : null,
  }
}

function formatUserDetail(user) {
  const stats = buildUserStats(user)

  return {
    user: {
      id: user.id,
      nickname: user.profile ? user.profile.nickname || '' : '',
      avatarUrl: user.profile ? user.profile.avatarUrl || '' : '',
      bio: user.profile ? user.profile.bio || '' : '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    stats,
    characterProfile: formatCharacterProfile(user.characterProfile),
    recentChapters: buildRecentChapters(user).slice(0, 5),
    recentGenerationTasks: user.generationTasks.slice(0, 5).map(formatGenerationTaskSummary),
  }
}

function buildUserStats(user) {
  return {
    diaryEntryCount: user.diaryEntries.length,
    generationTaskCount: user.generationTasks.length,
    completedChapterCount: countCompletedChapters(user.generationTasks),
    generatingTaskCount: user.generationTasks.filter((task) => task.status === 'pending' || task.status === 'processing').length,
    failedTaskCount: user.generationTasks.filter((task) => task.status === 'failed').length,
  }
}

function countCompletedChapters(tasks) {
  return tasks.filter((task) => task.status === 'completed' && findFirstImageUrl(parseJsonObject(task.resultJson))).length
}

function buildRecentChapters(user) {
  const latestTaskByDiaryId = new Map()

  for (const task of user.generationTasks) {
    if (!task.diaryEntryId || latestTaskByDiaryId.has(task.diaryEntryId)) {
      continue
    }

    latestTaskByDiaryId.set(task.diaryEntryId, task)
  }

  return user.diaryEntries.map((entry) => {
    const latestTask = latestTaskByDiaryId.get(entry.id) || null
    const imageUrl = latestTask ? findFirstImageUrl(parseJsonObject(latestTask.resultJson)) : ''

    return {
      diaryEntryId: entry.id,
      title: entry.chapterTitle || '',
      status: latestTask ? latestTask.status : 'no_task',
      coverImageUrl: imageUrl || null,
      createdAt: entry.createdAt.toISOString(),
    }
  })
}

function formatGenerationTaskSummary(task) {
  return {
    id: task.id,
    diaryEntryId: task.diaryEntryId,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    hasImage: Boolean(findFirstImageUrl(parseJsonObject(task.resultJson))),
  }
}

function formatCharacterProfile(profile) {
  if (!profile) {
    return null
  }

  return {
    nickname: profile.nickname || '',
    roleTitle: profile.roleTitle || '',
    description: profile.description || '',
    personalityText: profile.personalityText || '',
    appearanceText: profile.appearanceText || '',
    referenceImageUrl: profile.referenceImageUrl || '',
    updatedAt: profile.updatedAt.toISOString(),
  }
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

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (err) {
    return {}
  }
}

function normalizePositiveInt(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback
}

function throwNotFound() {
  const error = new Error('User not found')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  getAdminUserDetail,
  listAdminUsers,
}
