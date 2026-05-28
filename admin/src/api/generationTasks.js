import request from '../utils/request'

export function getGenerationTasks(params) {
  return request.get('/admin/generation-tasks', { params })
}

export function getGenerationTaskDetail(id) {
  return request.get(`/admin/generation-tasks/${id}`)
}
