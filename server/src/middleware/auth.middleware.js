const { fail } = require('../utils/response')
const { verifyUserToken } = require('../utils/jwt')
const { prisma } = require('../utils/prisma')

async function authMiddleware(req, res, next) {
  const token = readBearerToken(req)

  if (!token) {
    return fail(res, 401, '请先登录', 401)
  }

  let payload
  try {
    payload = verifyUserToken(token)
  } catch (err) {
    return fail(res, 401, '登录已失效，请重新登录', 401)
  }

  if (!payload || !payload.sub) {
    return fail(res, 401, '登录已失效，请重新登录', 401)
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (!user || user.status !== 'active') {
      return fail(res, 401, '登录已失效，请重新登录', 401)
    }

    req.user = {
      id: user.id,
      status: user.status,
    }

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

module.exports = authMiddleware
