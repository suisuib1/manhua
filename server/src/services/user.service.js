const { prisma } = require('../utils/prisma')

const settingKeys = [
  'autoSaveDraft',
  'keepPhotoMood',
  'privateMode',
  'diaryReminder',
  'generationReminder',
]

async function getCurrentUserBundle(userId) {
  await ensureUserCoreRecords(userId)

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      profile: true,
      setting: true,
      comicBooks: {
        orderBy: {
          sortOrder: 'asc',
        },
        take: 1,
      },
      quota: true,
    },
  })

  return formatUserBundle(user)
}

async function updateCurrentUserProfile(userId, input) {
  await ensureUserCoreRecords(userId)

  const data = pickProfileFields(input)
  const profile = await prisma.userProfile.update({
    where: {
      userId,
    },
    data,
  })

  return formatProfile(profile)
}

async function getCurrentUserSettings(userId) {
  await ensureUserCoreRecords(userId)

  const setting = await prisma.userSetting.findUnique({
    where: {
      userId,
    },
  })

  return formatSettings(setting)
}

async function updateCurrentUserSettings(userId, input) {
  await ensureUserCoreRecords(userId)

  const data = pickSettingFields(input)
  const setting = await prisma.userSetting.update({
    where: {
      userId,
    },
    data,
  })

  return formatSettings(setting)
}

async function ensureUserCoreRecords(userId) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        profile: true,
        setting: true,
        comicBooks: {
          take: 1,
        },
        quota: true,
      },
    })

    if (!user) {
      const error = new Error('用户不存在')
      error.status = 401
      error.code = 401
      throw error
    }

    if (!user.profile) {
      await tx.userProfile.create({
        data: {
          userId,
        },
      })
    }

    if (!user.setting) {
      await tx.userSetting.create({
        data: {
          userId,
        },
      })
    }

    if (user.comicBooks.length === 0) {
      await tx.comicBook.create({
        data: {
          ownerUserId: userId,
          title: '我的漫画日记',
        },
      })
    }

    if (!user.quota) {
      await tx.userQuota.create({
        data: {
          userId,
        },
      })
    }
  })
}

function pickProfileFields(input) {
  const data = {}

  if (Object.prototype.hasOwnProperty.call(input, 'nickname')) {
    data.nickname = assertMaxLength(input.nickname, 50, '昵称最多 50 个字符')
  }

  if (Object.prototype.hasOwnProperty.call(input, 'avatarUrl')) {
    data.avatarUrl = assertMaxLength(input.avatarUrl, 500, '头像地址最多 500 个字符')
  }

  if (Object.prototype.hasOwnProperty.call(input, 'bio')) {
    data.bio = assertMaxLength(input.bio, 200, '简介最多 200 个字符')
  }

  return data
}

function pickSettingFields(input) {
  const data = {}

  for (const key of settingKeys) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      continue
    }

    if (typeof input[key] !== 'boolean') {
      const error = new Error('设置字段必须是布尔值')
      error.status = 400
      error.code = 40001
      throw error
    }

    data[key] = input[key]
  }

  return data
}

function assertMaxLength(value, maxLength, message) {
  if (value !== null && value !== undefined && typeof value !== 'string') {
    const error = new Error('字段格式不正确')
    error.status = 400
    error.code = 40001
    throw error
  }

  if (value && value.length > maxLength) {
    const error = new Error(message)
    error.status = 400
    error.code = 40001
    throw error
  }

  return value
}

function formatUserBundle(user) {
  const comicBook = user.comicBooks[0]

  return {
    user: {
      id: user.id,
      status: user.status,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    },
    profile: formatProfile(user.profile),
    settings: formatSettings(user.setting),
    comicBook: {
      id: comicBook.id,
      title: comicBook.title,
      description: comicBook.description,
      coverImageUrl: comicBook.coverImageUrl,
      visibility: comicBook.visibility,
    },
    quota: {
      totalQuota: user.quota.totalQuota,
      usedQuota: user.quota.usedQuota,
      remainingQuota: user.quota.remainingQuota,
    },
  }
}

function formatProfile(profile) {
  return {
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
  }
}

function formatSettings(setting) {
  return {
    autoSaveDraft: setting.autoSaveDraft,
    keepPhotoMood: setting.keepPhotoMood,
    privateMode: setting.privateMode,
    diaryReminder: setting.diaryReminder,
    generationReminder: setting.generationReminder,
  }
}

module.exports = {
  getCurrentUserBundle,
  updateCurrentUserProfile,
  getCurrentUserSettings,
  updateCurrentUserSettings,
}
