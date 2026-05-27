const apiConfig = require('../config/api.config')
const { storageKeys } = require('./mock')

function normalizeUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return url
  }

  return `${apiConfig.baseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

function buildError(message, code, statusCode) {
  const error = new Error(message || '请求失败')
  error.code = code
  error.statusCode = statusCode
  return error
}

function request(options) {
  const { url, method = 'GET', data, auth = false, header = {}, timeout } = options
  const requestHeader = Object.assign({}, header)

  if (auth) {
    const token = wx.getStorageSync(storageKeys.authToken)
    if (token) {
      requestHeader.Authorization = `Bearer ${token}`
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: normalizeUrl(url),
      method,
      data,
      header: requestHeader,
      timeout,
      success(res) {
        const body = res.data || {}

        if (body.code === 0) {
          resolve(body.data)
          return
        }

        reject(buildError(body.message, body.code || res.statusCode, res.statusCode))
      },
      fail() {
        reject(buildError('网络连接失败，请检查服务是否已启动', -1, 0))
      },
    })
  })
}

module.exports = {
  request,
}
