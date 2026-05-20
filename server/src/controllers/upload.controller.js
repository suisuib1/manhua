const multer = require('multer')
const { success } = require('../utils/response')
const { uploadImageFile } = require('../middleware/upload.middleware')
const { buildUploadedImageResponse } = require('../services/upload.service')

function uploadImage(req, res, next) {
  uploadImageFile(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        err.status = 413
        err.code = 41301
        err.message = '图片大小不能超过 5MB'
      }
      return next(err)
    }

    if (!req.file) {
      const error = new Error('请上传图片文件')
      error.status = 400
      error.code = 40011
      return next(error)
    }

    return success(res, buildUploadedImageResponse(req.file))
  })
}

module.exports = {
  uploadImage,
}
