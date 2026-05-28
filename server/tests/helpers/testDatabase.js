const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

process.env.NODE_ENV = 'test'
const testDatabaseDir = fs.mkdtempSync(path.join(os.tmpdir(), `manhua-test-${process.pid}-`))
const testDatabasePath = path.join(testDatabaseDir, 'test.db')
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${testDatabasePath.replace(/\\/g, '/')}`

const { prisma } = require('../../src/utils/prisma')

const prismaDir = path.join(__dirname, '..', '..', 'prisma')
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
  if (prisma.adminUser) {
    await prisma.adminUser.deleteMany()
  }
  if (prisma.generationTask) {
    await prisma.generationTask.deleteMany()
  }
  if (prisma.diaryPhoto) {
    await prisma.diaryPhoto.deleteMany()
  }
  if (prisma.diaryEntry) {
    await prisma.diaryEntry.deleteMany()
  }
  if (prisma.characterProfile) {
    await prisma.characterProfile.deleteMany()
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
    fs.rmSync(testDatabaseDir, { recursive: true, force: true })
  } catch (err) {
    // Keep test outcomes focused on application failures, not OS cleanup races.
  }
})
