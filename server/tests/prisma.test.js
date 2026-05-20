const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const testDatabaseName = `test_issue2_${process.pid}.db`

process.env.DATABASE_URL = `file:../tests/${testDatabaseName}`

const prismaDir = path.join(__dirname, '..', 'prisma')
const testDatabasePath = path.join(__dirname, testDatabaseName)
const testJournalPath = path.join(__dirname, `${testDatabaseName}-journal`)

fs.rmSync(testDatabasePath, { force: true })
fs.rmSync(testJournalPath, { force: true })

const { prisma } = require('../src/utils/prisma')

const prefix = 'test_issue2_'
let migrationApplied = false

function uniqueEmail() {
  return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
}

async function applyMigrationOnce() {
  if (migrationApplied) return

  const migrationPath = path.join(
    prismaDir,
    'migrations',
    '20260520024721_init_core_tables',
    'migration.sql'
  )
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')
  const statements = migrationSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }

  migrationApplied = true
}

test('Prisma Client can connect to the local database', async () => {
  await applyMigrationOnce()

  const result = await prisma.$queryRaw`SELECT 1 as value`
  assert.equal(Number(result[0].value), 1)
})

test('Prisma can create and load the core user records', async () => {
  await applyMigrationOnce()

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

test.after(async () => {
  await prisma.$disconnect()
  try {
    fs.rmSync(testDatabasePath, { force: true })
    fs.rmSync(testJournalPath, { force: true })
  } catch (err) {
    if (err.code !== 'EPERM') throw err
  }
})
