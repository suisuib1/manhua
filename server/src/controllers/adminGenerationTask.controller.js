const { success } = require('../utils/response')
const {
  getAdminGenerationTaskDetail,
  listAdminGenerationTasks,
} = require('../services/adminGenerationTask.service')

async function listTasks(req, res, next) {
  try {
    return success(res, await listAdminGenerationTasks(req.query || {}))
  } catch (err) {
    return next(err)
  }
}

async function getTask(req, res, next) {
  try {
    return success(res, await getAdminGenerationTaskDetail(req.params.id))
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getTask,
  listTasks,
}
