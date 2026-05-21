const { request } = require('./api')

async function createGenerationTask(diaryEntryId) {
  if (!diaryEntryId) {
    throw new Error('diaryEntryId is required')
  }

  return request({
    url: '/api/generation-tasks',
    method: 'POST',
    data: {
      diaryEntryId,
    },
    auth: true,
  })
}

async function getGenerationTask(id) {
  if (!id) {
    throw new Error('generationTaskId is required')
  }

  return request({
    url: `/api/generation-tasks/${id}`,
    method: 'GET',
    auth: true,
  })
}

module.exports = {
  createGenerationTask,
  getGenerationTask,
}
