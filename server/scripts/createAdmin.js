const path = require('node:path')

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
})

const { prisma } = require('../src/utils/prisma')
const { hashAdminPassword } = require('../src/services/admin.service')

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const username = normalizeArg(args.username)
  const password = normalizeArg(args.password)
  const displayName = normalizeArg(args.displayName) || username

  if (!username || !password) {
    throw new Error('Usage: node scripts/createAdmin.js --username admin --password <password> --displayName 超级管理员')
  }

  if (password.length < 8) {
    throw new Error('Admin password must be at least 8 characters.')
  }

  const passwordHash = await hashAdminPassword(password)
  const admin = await prisma.adminUser.upsert({
    where: {
      username,
    },
    create: {
      username,
      passwordHash,
      displayName,
      status: 'active',
    },
    update: {
      passwordHash,
      displayName,
      status: 'active',
    },
  })

  console.log(`Admin user is ready: ${admin.username}`)
}

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) {
      continue
    }

    const key = item.slice(2)
    args[key] = argv[index + 1]
    index += 1
  }

  return args
}

function normalizeArg(value) {
  return typeof value === 'string' ? value.trim() : ''
}

main()
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
