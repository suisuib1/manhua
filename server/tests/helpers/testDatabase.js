const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env'),
})

process.env.NODE_ENV = 'test'

const testSchemaName = `test_${process.pid}`
const baseDatabaseUrl = process.env.DATABASE_URL

if (!baseDatabaseUrl || !baseDatabaseUrl.startsWith('postgresql://')) {
  throw new Error('PostgreSQL DATABASE_URL is required for tests')
}

process.env.DATABASE_URL = withSchema(baseDatabaseUrl, testSchemaName)

const { prisma } = require('../../src/utils/prisma')

const prismaDir = path.join(__dirname, '..', '..', 'prisma')
let migrationApplied = false

async function applyMigrationOnce() {
  if (migrationApplied) return

  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${testSchemaName}"`)

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
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE`)
  } catch (err) {
    // Keep test outcomes focused on application failures, not OS cleanup races.
  } finally {
    await prisma.$disconnect()
  }
})

function withSchema(databaseUrl, schemaName) {
  const url = new URL(databaseUrl)
  url.searchParams.set('schema', schemaName)
  return url.toString()
}
