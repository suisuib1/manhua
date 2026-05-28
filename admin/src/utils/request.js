import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function getAdminToken() {
  return localStorage.getItem('adminToken') || ''
}

request.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const body = response.data
    if (!body || body.code !== 0) {
      if (body && body.code === 401 && unauthorizedHandler) {
        unauthorizedHandler()
      }
      const error = new Error(body && body.message ? body.message : '请求失败')
      error.response = response
      error.code = body && body.code
      throw error
    }

    return body.data
  },
  (error) => {
    const status = error.response && error.response.status
    const code = error.response && error.response.data && error.response.data.code
    const message = error.response && error.response.data && error.response.data.message

    if (status === 401 || code === 401) {
      if (unauthorizedHandler) {
        unauthorizedHandler()
      }
      return Promise.reject(new Error(message || '登录已失效，请重新登录'))
    }

    return Promise.reject(new Error(message || error.message || '请求失败'))
  },
)

export function showRequestError(error, fallback = '请求失败') {
  ElMessage.error(error && error.message ? error.message : fallback)
}

export default request
