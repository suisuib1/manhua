const { fail } = require('../utils/response')

function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  console.error('[server-error]', err)

  const status = err.statusCode || err.status || 500
  const code = err.code || (status === 500 ? 50000 : status)
  const message = err.message || '服务端错误'

  return fail(res, code, message, status)
}

module.exports = errorMiddleware
