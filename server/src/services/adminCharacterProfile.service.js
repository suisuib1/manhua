const { prisma } = require('../utils/prisma')

const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

async function listAdminCharacterProfiles(query) {
  const page = normalizePositiveInt(query.page, defaultPage)
  const pageSize = Math.min(normalizePositiveInt(query.pageSize, defaultPageSize), maxPageSize)
  const where = buildProfileWhere(query)

  const [profiles, total] = await prisma.$transaction([
    prisma.characterProfile.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: profileInclude(),
    }),
    prisma.characterProfile.count({ where }),
  ])

  return {
    items: profiles.map(formatProfileSummary),
    pagination: {
      page,
      pageSize,
      total,
    },
  }
}

async function getAdminCharacterProfileDetail(id) {
  const profile = await prisma.characterProfile.findUnique({
    where: {
      id,
    },
    include: profileInclude(),
  })

  if (!profile || !profile.owner) {
    throwNotFound()
  }

  return formatProfileDetail(profile)
}

function buildProfileWhere(query) {
  const where = {}
  const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : ''
  const updatedAt = buildDateRange(query.dateFrom, query.dateTo)

  if (updatedAt) {
    where.updatedAt = updatedAt
  }

  if (keyword) {
    where.OR = [
      {
        ownerUserId: {
          contains: keyword,
        },
      },
      {
        nickname: {
          contains: keyword,
        },
      },
      {
        roleTitle: {
          contains: keyword,
        },
      },
      {
        description: {
          contains: keyword,
        },
      },
      {
        owner: {
          profile: {
            nickname: {
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

function profileInclude() {
  return {
    owner: {
      include: {
        profile: true,
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
      },
    },
  }
}

function formatProfileSummary(profile) {
  const stats = buildOwnerStats(profile.owner)

  return {
    id: profile.id,
    ownerUserId: profile.ownerUserId,
    userNickname: profile.owner.profile ? profile.owner.profile.nickname || '' : '',
    userAvatarUrl: profile.owner.profile ? profile.owner.profile.avatarUrl || '' : '',
    nickname: profile.nickname || '',
    roleTitle: profile.roleTitle || '',
    description: profile.description || '',
    personalityText: profile.personalityText || '',
    appearanceText: profile.appearanceText || '',
    referenceImageUrl: profile.referenceImageUrl || '',
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    diaryEntryCount: stats.diaryEntryCount,
    generationTaskCount: stats.generationTaskCount,
  }
}

function formatProfileDetail(profile) {
  const owner = profile.owner
  const stats = buildOwnerStats(owner)

  return {
    profile: {
      id: profile.id,
      ownerUserId: profile.ownerUserId,
      nickname: profile.nickname || '',
      roleTitle: profile.roleTitle || '',
      description: profile.description || '',
      personalityText: profile.personalityText || '',
      appearanceText: profile.appearanceText || '',
      referenceImageUrl: profile.referenceImageUrl || '',
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    user: {
      id: owner.id,
      nickname: owner.profile ? owner.profile.nickname || '' : '',
      avatarUrl: owner.profile ? owner.profile.avatarUrl || '' : '',
      createdAt: owner.createdAt.toISOString(),
    },
    stats,
    recentChapters: buildRecentChapters(owner).slice(0, 5),
    recentGenerationTasks: owner.generationTasks.slice(0, 5).map(formatGenerationTaskSummary),
  }
}

function buildOwnerStats(owner) {
  return {
    diaryEntryCount: owner.diaryEntries.length,
    generationTaskCount: owner.generationTasks.length,
    completedChapterCount: countCompletedChapters(owner.generationTasks),
  }
}

function countCompletedChapters(tasks) {
  return tasks.filter((task) => task.status === 'completed' && findFirstImageUrl(parseJsonObject(task.resultJson))).length
}

function buildRecentChapters(owner) {
  const latestTaskByDiaryId = new Map()

  for (const task of owner.generationTasks) {
    if (!task.diaryEntryId || latestTaskByDiaryId.has(task.diaryEntryId)) {
      continue
    }

    latestTaskByDiaryId.set(task.diaryEntryId, task)
  }

  return owner.diaryEntries.map((entry) => {
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
    hasImage: Boolean(findFirstImageUrl(parseJsonObject(task.resultJson))),
    createdAt: task.createdAt.toISOString(),
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
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
  const error = new Error('Character profile not found')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  getAdminCharacterProfileDetail,
  listAdminCharacterProfiles,
}
