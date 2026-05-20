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
  const { url, method = 'GET', data, auth = false, header = {} } = options
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
      success(res) {
        const body = res.data || {}

        if (body.code === 0) {
          resolve(body.data)
          return
        }

        reject(buildError(body.message, body.code || res.statusCode, res.statusCode))
      },
      fail(error) {
        reject(buildError(error && error.errMsg ? error.errMsg : '网络请求失败', -1, 0))
      },
    })
  })
}

module.exports = {
  request,
}
