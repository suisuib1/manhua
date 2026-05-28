const crypto = require('node:crypto')
const { prisma } = require('../utils/prisma')
const { signAdminToken } = require('../utils/jwt')

const passwordHashPrefix = 'scrypt'
const passwordKeyLength = 64

async function loginAdmin(input) {
  const username = normalizeRequiredString(input && input.username)
  const password = normalizeRequiredString(input && input.password)

  if (!username || !password) {
    throwUnauthorized()
  }

  const admin = await prisma.adminUser.findUnique({
    where: {
      username,
    },
  })

  if (!admin || admin.status !== 'active') {
    throwUnauthorized()
  }

  const isValidPassword = await verifyAdminPassword(password, admin.passwordHash)
  if (!isValidPassword) {
    throwUnauthorized()
  }

  const updated = await prisma.adminUser.update({
    where: {
      id: admin.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  })

  return {
    token: signAdminToken(updated),
    admin: formatAdmin(updated),
  }
}

async function getDashboardStats() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    userCount,
    todayNewUserCount,
    diaryEntryCount,
    generationTaskCount,
    statusGroups,
    recentFailedTasks,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.diaryEntry.count({
      where: {
        deletedAt: null,
      },
    }),
    prisma.generationTask.count(),
    prisma.generationTask.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    }),
    prisma.generationTask.findMany({
      where: {
        status: 'failed',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        diaryEntryId: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        finishedAt: true,
      },
    }),
  ])

  return {
    userCount,
    todayNewUserCount,
    diaryEntryCount,
    generationTaskCount,
    generationTaskStatusCounts: formatStatusCounts(statusGroups),
    recentFailedTasks: recentFailedTasks.map(formatFailedTask),
  }
}

function getCurrentAdmin(admin) {
  return formatAdmin(admin)
}

async function hashAdminPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt)
  return `${passwordHashPrefix}:${salt}:${derivedKey.toString('hex')}`
}

async function verifyAdminPassword(password, passwordHash) {
  const parts = String(passwordHash || '').split(':')
  if (parts.length !== 3 || parts[0] !== passwordHashPrefix) {
    return false
  }

  const [, salt, expectedHex] = parts
  const actual = await scrypt(password, salt)
  const expected = Buffer.from(expectedHex, 'hex')

  if (actual.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(actual, expected)
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, passwordKeyLength, (err, derivedKey) => {
      if (err) {
        reject(err)
        return
      }

      resolve(derivedKey)
    })
  })
}

function formatAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName || '',
  }
}

function formatStatusCounts(groups) {
  const counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }

  for (const group of groups) {
    if (Object.prototype.hasOwnProperty.call(counts, group.status)) {
      counts[group.status] = group._count.status
    }
  }

  return counts
}

function formatFailedTask(task) {
  return {
    taskId: task.id,
    diaryEntryId: task.diaryEntryId,
    status: task.status,
    errorMessage: summarizeError(task.errorMessage),
    createdAt: task.createdAt.toISOString(),
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
  }
}

function summarizeError(value) {
  return String(value || '').slice(0, 120)
}

function normalizeRequiredString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function throwUnauthorized() {
  const error = new Error('管理员账号或密码错误')
  error.status = 401
  error.code = 401
  throw error
}

module.exports = {
  getCurrentAdmin,
  getDashboardStats,
  hashAdminPassword,
  loginAdmin,
  verifyAdminPassword,
}
