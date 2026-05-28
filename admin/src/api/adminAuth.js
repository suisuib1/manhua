import request from '../utils/request'

export function login(payload) {
  return request.post('/admin/auth/login', payload)
}

export function getAdminMe() {
  return request.get('/admin/me')
}
