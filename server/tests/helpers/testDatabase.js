const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:../tests/test_issue_backend_${process.pid}.db`

const { prisma } = require('../../src/utils/prisma')

const prismaDir = path.join(__dirname, '..', '..', 'prisma')
const testDatabasePath = path.join(__dirname, '..', `test_issue_backend_${process.pid}.db`)
const testJournalPath = path.join(__dirname, '..', `test_issue_backend_${process.pid}.db-journal`)
let migrationApplied = false

async function applyMigrationOnce() {
  if (migrationApplied) return

  const migrationsDir = path.join(prismaDir, 'migrations')
  const migrationDirs = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const migrationDir of migrationDirs) {
    const migrationPath = path.join(migrationsDir, migrationDir, 'migration.sql')
    const migrationSql = fs.readFileSync(migrationPath, 'utf8')
    const statements = migrationSql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement)
    }
  }

  migrationApplied = true
}

async function clearCoreTables() {
  await applyMigrationOnce()
  if (prisma.diaryPhoto) {
    await prisma.diaryPhoto.deleteMany()
  }
  if (prisma.diaryEntry) {
    await prisma.diaryEntry.deleteMany()
  }
  await prisma.userQuota.deleteMany()
  await prisma.comicBook.deleteMany()
  await prisma.userSetting.deleteMany()
  await prisma.userProfile.deleteMany()
  await prisma.user.deleteMany()
}

module.exports = {
  applyMigrationOnce,
  clearCoreTables,
  prisma,
}

test.after(async () => {
  await prisma.$disconnect()

  try {
    fs.rmSync(testDatabasePath, { force: true })
    fs.rmSync(testJournalPath, { force: true })
  } catch (err) {
    if (err.code !== 'EPERM') throw err
  }
})
