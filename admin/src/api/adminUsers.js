import request from '../utils/request'

export function listAdminUsers(params) {
  return request.get('/admin/users', { params })
}

export function getAdminUserDetail(id) {
  return request.get(`/admin/users/${id}`)
}
