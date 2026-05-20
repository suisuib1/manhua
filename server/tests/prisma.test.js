const test = require('node:test')
const assert = require('node:assert/strict')

const { applyMigrationOnce, clearCoreTables, prisma } = require('./helpers/testDatabase')

const prefix = 'test_issue2_'

function uniqueEmail() {
  return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
}

test('Prisma Client can connect to the local database', async () => {
  await applyMigrationOnce()

  const result = await prisma.$queryRaw`SELECT 1 as value`
  assert.equal(Number(result[0].value), 1)
})

test('Prisma can create and load the core user records', async () => {
  await clearCoreTables()

  const email = uniqueEmail()

  let userId

  try {
    const user = await prisma.user.create({
      data: {
        wxOpenid: email,
        wxUnionid: `${email}_union`,
      },
    })
    userId = user.id

    await prisma.userProfile.create({
      data: {
        userId,
        nickname: `${prefix}nick`,
        avatarUrl: `${prefix}avatar.png`,
        bio: `${prefix}bio`,
      },
    })

    await prisma.userSetting.create({
      data: {
        userId,
      },
    })

    await prisma.comicBook.create({
      data: {
        ownerUserId: userId,
        title: `${prefix}book`,
        description: `${prefix}desc`,
        coverImageUrl: `${prefix}cover.png`,
        visibility: 'private',
        sortOrder: 0,
      },
    })

    await prisma.userQuota.create({
      data: {
        userId,
        totalQuota: 3,
        usedQuota: 1,
        remainingQuota: 2,
      },
    })

    const loaded = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        setting: true,
        comicBooks: true,
        quota: true,
      },
    })

    assert.equal(loaded.wxOpenid, email)
    assert.equal(loaded.profile.nickname, `${prefix}nick`)
    assert.equal(loaded.setting.privateMode, true)
    assert.equal(loaded.comicBooks[0].title, `${prefix}book`)
    assert.equal(loaded.quota.remainingQuota, 2)
  } finally {
    if (userId) {
      await prisma.userQuota.deleteMany({ where: { userId } })
      await prisma.comicBook.deleteMany({ where: { ownerUserId: userId } })
      await prisma.userSetting.deleteMany({ where: { userId } })
      await prisma.userProfile.deleteMany({ where: { userId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  }
})
