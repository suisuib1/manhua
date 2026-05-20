const { success } = require('../utils/response')

function getHealth(req, res) {
  return success(res, {
    status: 'ok',
    service: 'manhua-api',
  })
}

module.exports = {
  getHealth,
}
