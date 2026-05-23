const { request } = require('./api')

const generationTaskRequestTimeout = 120000

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
    timeout: generationTaskRequestTimeout,
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
  generationTaskRequestTimeout,
}
