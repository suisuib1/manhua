const { success } = require('../utils/response')
const {
  createGenerationTask,
  getGenerationTask,
} = require('../services/generationTask.service')

async function createTask(req, res, next) {
  try {
    const data = await createGenerationTask(req.user.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function getTask(req, res, next) {
  try {
    const data = await getGenerationTask(req.user.id, req.params.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  createTask,
  getTask,
}
