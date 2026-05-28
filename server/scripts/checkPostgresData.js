const path = require('node:path')

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
})

const { prisma } = require('../src/utils/prisma')
const {
  tableDefinitions,
  getSqliteDatabasePath,
  openSqliteDatabase,
  quoteIdentifier,
  hasSqliteTable,
  getSqliteCount,
  getPostgresCount,
  maskId,
} = require('./sqlitePostgresData')

const sampleTables = new Set([
  'users',
  'diary_entries',
  'generation_tasks',
  'character_profiles',
])

async function main() {
  const sqlitePath = getSqliteDatabasePath()
  const sqlite = openSqliteDatabase(sqlitePath)

  try {
    console.log(`SQLite source: ${sqlitePath}`)
    console.log('PostgreSQL target: current DATABASE_URL')
    console.log('Table counts:')

    for (const definition of tableDefinitions) {
      await printTableCheck(sqlite, definition)
    }

    console.log('Check completed. Count mismatches are expected before data migration.')
  } finally {
    sqlite.close()
  }
}

async function printTableCheck(sqlite, definition) {
  const sourceExists = hasSqliteTable(sqlite, definition.name)
  const sourceCount = sourceExists ? getSqliteCount(sqlite, definition.name) : null
  const targetCount = await getPostgresCount(prisma, definition.name)

  if (!sourceExists) {
    console.log(`- ${definition.name}: SQLite table missing, PostgreSQL ${targetCount}, skipped`)
    return
  }

  const status = sourceCount === targetCount ? 'OK' : 'MISMATCH'
  console.log(`- ${definition.name}: SQLite ${sourceCount}, PostgreSQL ${targetCount}, ${status}`)

  if (sampleTables.has(definition.name) && sourceCount > 0) {
    await printSamples(sqlite, definition.name)
  }
}

async function printSamples(sqlite, tableName) {
  const sourceRows = sqlite
    .prepare(
      `SELECT id, created_at FROM ${quoteIdentifier(tableName)} ORDER BY ${quoteIdentifier('created_at')} DESC, ${quoteIdentifier('id')} DESC LIMIT 3`,
    )
    .all()

  for (const row of sourceRows) {
    const targetRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM ${quoteIdentifier(tableName)} WHERE id = $1 LIMIT 1`,
      row.id,
    )
    const exists = targetRows.length > 0 ? 'yes' : 'no'
    console.log(`  sample id=${maskId(row.id)}, created_at=${formatDate(row.created_at)}, target_exists=${exists}`)
  }
}

function formatDate(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  if (/^\d+$/.test(String(value))) {
    return new Date(Number(value)).toISOString()
  }
  return String(value).slice(0, 19)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
