const jwt = require('jsonwebtoken')

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    const error = new Error('JWT_SECRET 未配置')
    error.status = 500
    error.code = 50001
    throw error
  }

  return secret
}

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  )
}

function verifyUserToken(token) {
  return jwt.verify(token, getJwtSecret())
}

module.exports = {
  signUserToken,
  verifyUserToken,
}
