const fs = require('node:fs')
const path = require('node:path')

const emitWarning = process.emitWarning
process.emitWarning = function emitNonSqliteWarning(warning, ...args) {
  const message = typeof warning === 'string' ? warning : warning && warning.message
  const type = args[0] || (warning && warning.name)
  if (type === 'ExperimentalWarning' && String(message || '').includes('SQLite')) {
    return
  }
  return emitWarning.call(process, warning, ...args)
}

const { DatabaseSync } = require('node:sqlite')

const defaultSqliteDatabasePath = path.join(
  __dirname,
  '..',
  'prisma',
  'backups',
  'dev-before-postgres-20260528-135734.db',
)

const tableDefinitions = [
  {
    name: 'users',
    columns: ['id', 'wx_openid', 'wx_unionid', 'status', 'last_login_at', 'created_at', 'updated_at'],
    dateColumns: ['last_login_at', 'created_at', 'updated_at'],
  },
  {
    name: 'user_profiles',
    columns: ['id', 'user_id', 'nickname', 'avatar_url', 'bio', 'created_at', 'updated_at'],
    dateColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'user_settings',
    columns: [
      'id',
      'user_id',
      'auto_save_draft',
      'keep_photo_mood',
      'private_mode',
      'diary_reminder',
      'generation_reminder',
      'created_at',
      'updated_at',
    ],
    booleanColumns: [
      'auto_save_draft',
      'keep_photo_mood',
      'private_mode',
      'diary_reminder',
      'generation_reminder',
    ],
    dateColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'user_quotas',
    columns: [
      'id',
      'user_id',
      'total_quota',
      'used_quota',
      'remaining_quota',
      'created_at',
      'updated_at',
    ],
    dateColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'comic_books',
    columns: [
      'id',
      'owner_user_id',
      'title',
      'description',
      'cover_image_url',
      'visibility',
      'sort_order',
      'created_at',
      'updated_at',
    ],
    dateColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'character_profiles',
    columns: [
      'id',
      'owner_user_id',
      'nickname',
      'role_title',
      'description',
      'personality_text',
      'appearance_text',
      'reference_image_url',
      'created_at',
      'updated_at',
    ],
    dateColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'diary_entries',
    columns: [
      'id',
      'owner_user_id',
      'chapter_title',
      'diary_date',
      'diary_text',
      'page_count',
      'page_mode',
      'selected_tags_json',
      'status',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    dateColumns: ['diary_date', 'created_at', 'updated_at', 'deleted_at'],
  },
  {
    name: 'diary_photos',
    columns: [
      'id',
      'diary_entry_id',
      'owner_user_id',
      'image_url',
      'original_name',
      'mime_type',
      'size_bytes',
      'sort_order',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    dateColumns: ['created_at', 'updated_at', 'deleted_at'],
  },
  {
    name: 'generation_tasks',
    columns: [
      'id',
      'owner_user_id',
      'diary_entry_id',
      'status',
      'task_type',
      'prompt_snapshot',
      'input_json',
      'result_json',
      'error_message',
      'retry_count',
      'started_at',
      'finished_at',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    dateColumns: ['started_at', 'finished_at', 'created_at', 'updated_at', 'deleted_at'],
  },
  {
    name: 'admin_users',
    columns: [
      'id',
      'username',
      'password_hash',
      'display_name',
      'status',
      'last_login_at',
      'created_at',
      'updated_at',
    ],
    dateColumns: ['last_login_at', 'created_at', 'updated_at'],
  },
]

function getSqliteDatabasePath() {
  return process.env.SQLITE_DATABASE_PATH
    ? path.resolve(process.env.SQLITE_DATABASE_PATH)
    : defaultSqliteDatabasePath
}

function openSqliteDatabase(databasePath = getSqliteDatabasePath()) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`SQLite database not found: ${databasePath}`)
  }
  return new DatabaseSync(databasePath, { readOnly: true })
}

function quoteIdentifier(identifier) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }
  return `"${identifier}"`
}

function hasSqliteTable(sqlite, tableName) {
  const found = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName)
  return Boolean(found)
}

function getSqliteCount(sqlite, tableName) {
  const result = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`).get()
  return Number(result.count)
}

function getSqliteColumns(sqlite, tableName) {
  return sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all().map((column) => column.name)
}

function readSqliteRows(sqlite, definition) {
  const columns = definition.columns.map(quoteIdentifier).join(', ')
  return sqlite
    .prepare(
      `SELECT ${columns} FROM ${quoteIdentifier(definition.name)} ORDER BY ${quoteIdentifier('created_at')} ASC, ${quoteIdentifier('id')} ASC`,
    )
    .all()
}

async function getPostgresCount(prisma, tableName) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}`,
  )
  return Number(result[0].count)
}

function normalizeRow(row, definition) {
  const booleanColumns = new Set(definition.booleanColumns || [])
  const dateColumns = new Set(definition.dateColumns || [])

  return definition.columns.map((column) => {
    const value = row[column]

    if (value === null || value === undefined) {
      return null
    }

    if (booleanColumns.has(column)) {
      return Boolean(value)
    }

    if (dateColumns.has(column)) {
      return normalizeDate(value, `${definition.name}.${column}`)
    }

    return value
  })
}

function normalizeDate(value, fieldName) {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'number') {
    return new Date(value)
  }

  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T')
    const date = new Date(normalized)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  throw new Error(`Invalid date value in ${fieldName}`)
}

function createInsertSql(definition) {
  const columns = definition.columns.map(quoteIdentifier).join(', ')
  const placeholders = definition.columns.map((_, index) => `$${index + 1}`).join(', ')
  return `INSERT INTO ${quoteIdentifier(definition.name)} (${columns}) VALUES (${placeholders})`
}

function maskId(value) {
  if (!value) {
    return ''
  }
  const text = String(value)
  if (text.length <= 10) {
    return text
  }
  return `${text.slice(0, 6)}...${text.slice(-4)}`
}

module.exports = {
  defaultSqliteDatabasePath,
  tableDefinitions,
  getSqliteDatabasePath,
  openSqliteDatabase,
  quoteIdentifier,
  hasSqliteTable,
  getSqliteCount,
  getSqliteColumns,
  getPostgresCount,
  readSqliteRows,
  normalizeRow,
  createInsertSql,
  maskId,
}
