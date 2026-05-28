const { fail } = require('../utils/response')
const { verifyAdminToken } = require('../utils/jwt')
const { prisma } = require('../utils/prisma')

async function adminAuthMiddleware(req, res, next) {
  const token = readBearerToken(req)

  if (!token) {
    return fail(res, 401, '请先登录后台', 401)
  }

  let payload
  try {
    payload = verifyAdminToken(token)
  } catch (err) {
    return fail(res, 401, '后台登录已失效，请重新登录', 401)
  }

  if (!payload || !payload.sub || payload.type !== 'admin') {
    return fail(res, 401, '后台登录已失效，请重新登录', 401)
  }

  try {
    const admin = await prisma.adminUser.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        status: true,
      },
    })

    if (!admin || admin.status !== 'active') {
      return fail(res, 401, '后台登录已失效，请重新登录', 401)
    }

    req.admin = admin
    return next()
  } catch (err) {
    return next(err)
  }
}

function readBearerToken(req) {
  const authorization = req.headers.authorization

  if (!authorization || typeof authorization !== 'string') {
    return null
  }

  const [type, token] = authorization.split(' ')

  if (type !== 'Bearer' || !token) {
    return null
  }

  return token
}

module.exports = adminAuthMiddleware
