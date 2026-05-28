const { success } = require('../utils/response')
const {
  getAdminUserDetail,
  listAdminUsers,
} = require('../services/adminUser.service')

async function listUsers(req, res, next) {
  try {
    return success(res, await listAdminUsers(req.query || {}))
  } catch (err) {
    return next(err)
  }
}

async function getUser(req, res, next) {
  try {
    return success(res, await getAdminUserDetail(req.params.id))
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getUser,
  listUsers,
}
