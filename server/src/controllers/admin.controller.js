const { success } = require('../utils/response')
const {
  getCurrentAdmin,
  getDashboardStats,
  loginAdmin,
} = require('../services/admin.service')

async function login(req, res, next) {
  try {
    return success(res, await loginAdmin(req.body || {}))
  } catch (err) {
    return next(err)
  }
}

function me(req, res) {
  return success(res, getCurrentAdmin(req.admin))
}

async function dashboard(req, res, next) {
  try {
    return success(res, await getDashboardStats())
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  dashboard,
  login,
  me,
}
