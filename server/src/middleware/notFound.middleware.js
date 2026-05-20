const { fail } = require('../utils/response')

function notFoundMiddleware(req, res) {
  return fail(res, 404, '接口不存在', 404)
}

module.exports = notFoundMiddleware
