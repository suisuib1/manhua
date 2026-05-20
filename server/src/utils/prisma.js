const { PrismaClient } = require('@prisma/client')

const globalForPrisma = globalThis

const prisma = globalForPrisma.__manhuaPrismaClient || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__manhuaPrismaClient = prisma
}

module.exports = {
  prisma,
}
