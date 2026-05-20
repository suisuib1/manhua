const { prisma } = require('../utils/prisma')

async function findOrCreateUserByWechatIdentity({ openid, unionid, profile }) {
  const existingUser = await prisma.user.findUnique({
    where: {
      wxOpenid: openid,
    },
    include: {
      profile: true,
    },
  })

  if (existingUser) {
    const user = await updateExistingUser(existingUser, { unionid, profile })

    return {
      user,
      isNewUser: false,
    }
  }

  const user = await createNewUser({ openid, unionid, profile })

  return {
    user,
    isNewUser: true,
  }
}

async function updateExistingUser(existingUser, { unionid, profile }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        wxUnionid: existingUser.wxUnionid || unionid || null,
        lastLoginAt: new Date(),
      },
      include: {
        profile: true,
      },
    })

    if (user.profile && shouldFillProfile(user.profile, profile)) {
      await tx.userProfile.update({
        where: {
          userId: user.id,
        },
        data: buildProfilePatch(user.profile, profile),
      })
    }

    return tx.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        profile: true,
      },
    })
  })
}

async function createNewUser({ openid, unionid, profile }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        wxOpenid: openid,
        wxUnionid: unionid || null,
        lastLoginAt: new Date(),
      },
    })

    await tx.userProfile.create({
      data: {
        userId: user.id,
        nickname: profile && profile.nickname ? profile.nickname : null,
        avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : null,
      },
    })

    await tx.userSetting.create({
      data: {
        userId: user.id,
        autoSaveDraft: true,
        keepPhotoMood: true,
        privateMode: true,
        diaryReminder: false,
        generationReminder: true,
      },
    })

    await tx.comicBook.create({
      data: {
        ownerUserId: user.id,
        title: '我的漫画日记',
      },
    })

    await tx.userQuota.create({
      data: {
        userId: user.id,
        totalQuota: 0,
        usedQuota: 0,
        remainingQuota: 0,
      },
    })

    return tx.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        profile: true,
      },
    })
  })
}

function shouldFillProfile(currentProfile, nextProfile) {
  if (!nextProfile) return false

  return Boolean(
    (!currentProfile.nickname && nextProfile.nickname) ||
    (!currentProfile.avatarUrl && nextProfile.avatarUrl)
  )
}

function buildProfilePatch(currentProfile, nextProfile) {
  const patch = {}

  if (!currentProfile.nickname && nextProfile && nextProfile.nickname) {
    patch.nickname = nextProfile.nickname
  }

  if (!currentProfile.avatarUrl && nextProfile && nextProfile.avatarUrl) {
    patch.avatarUrl = nextProfile.avatarUrl
  }

  return patch
}

module.exports = {
  findOrCreateUserByWechatIdentity,
}
