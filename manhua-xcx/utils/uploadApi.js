const apiConfig = require('../config/api.config')
const { storageKeys } = require('./mock')

function normalizeUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return url
  }

  return `${apiConfig.baseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

function buildError(message, code, statusCode) {
  const error = new Error(message || '上传失败')
  error.code = code
  error.statusCode = statusCode
  return error
}

function parseUploadResponse(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch (error) {
      throw buildError('上传响应解析失败', -1, 0)
    }
  }

  return data || {}
}

function uploadImage(filePath) {
  const token = wx.getStorageSync(storageKeys.authToken)

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: normalizeUrl('/api/uploads/images'),
      filePath,
      name: 'file',
      header: token ? {
        Authorization: `Bearer ${token}`,
      } : {},
      success(res) {
        let body

        try {
          body = parseUploadResponse(res.data)
        } catch (error) {
          reject(error)
          return
        }

        if (body.code === 0) {
          resolve(body.data)
          return
        }

        reject(buildError(body.message, body.code || res.statusCode, res.statusCode))
      },
      fail(error) {
        reject(buildError(error && error.errMsg ? error.errMsg : '上传失败', -1, 0))
      },
    })
  })
}

module.exports = {
  uploadImage,
  parseUploadResponse,
}
