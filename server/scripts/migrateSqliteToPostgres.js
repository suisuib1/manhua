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
  hasSqliteTable,
  getSqliteCount,
  getSqliteColumns,
  getPostgresCount,
  readSqliteRows,
  normalizeRow,
  createInsertSql,
} = require('./sqlitePostgresData')

async function main() {
  const sqlitePath = getSqliteDatabasePath()
  const sqlite = openSqliteDatabase(sqlitePath)

  try {
    console.log(`SQLite source: ${sqlitePath}`)
    console.log('PostgreSQL target: current DATABASE_URL')

    const plan = await buildMigrationPlan(sqlite)
    const blockers = plan.filter((item) => item.shouldMigrate && item.targetCount > 0)

    if (blockers.length > 0) {
      console.error('Migration aborted: target PostgreSQL tables are not empty.')
      for (const item of blockers) {
        console.error(`- ${item.name}: SQLite ${item.sourceCount}, PostgreSQL ${item.targetCount}`)
      }
      console.error('Please migrate only into empty target tables. This script will not delete or overwrite data.')
      process.exitCode = 1
      return
    }

    await prisma.$transaction(async (tx) => {
      for (const item of plan) {
        if (!item.sourceExists) {
          console.log(`${item.name}: skipped, old SQLite table does not exist`)
          continue
        }

        if (item.sourceCount === 0) {
          console.log(`${item.name}: skipped, SQLite table is empty`)
          continue
        }

        const rows = readSqliteRows(sqlite, item.definition)
        const insertSql = createInsertSql(item.definition)

        for (const row of rows) {
          await tx.$executeRawUnsafe(insertSql, ...normalizeRow(row, item.definition))
        }

        console.log(`${item.name}: migrated ${rows.length}`)
      }
    })

    console.log('Migration completed.')
    await printTargetSummary()
  } finally {
    sqlite.close()
  }
}

async function buildMigrationPlan(sqlite) {
  const plan = []

  for (const definition of tableDefinitions) {
    const sourceExists = hasSqliteTable(sqlite, definition.name)
    const targetCount = await getPostgresCount(prisma, definition.name)
    let sourceCount = 0

    if (sourceExists) {
      assertSqliteColumns(sqlite, definition)
      sourceCount = getSqliteCount(sqlite, definition.name)
    }

    plan.push({
      name: definition.name,
      definition,
      sourceExists,
      sourceCount,
      targetCount,
      shouldMigrate: sourceExists && sourceCount > 0,
    })
  }

  return plan
}

function assertSqliteColumns(sqlite, definition) {
  const actualColumns = new Set(getSqliteColumns(sqlite, definition.name))
  const missingColumns = definition.columns.filter((column) => !actualColumns.has(column))

  if (missingColumns.length > 0) {
    throw new Error(`${definition.name} is missing columns: ${missingColumns.join(', ')}`)
  }
}

async function printTargetSummary() {
  console.log('PostgreSQL target counts:')
  for (const definition of tableDefinitions) {
    const count = await getPostgresCount(prisma, definition.name)
    console.log(`- ${definition.name}: ${count}`)
  }
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
