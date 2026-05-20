const fs = require('node:fs')
const multer = require('multer')
const {
  buildImageFilename,
  getImageUploadDir,
  isAllowedImage,
  maxImageSizeBytes,
} = require('../services/upload.service')

fs.mkdirSync(getImageUploadDir(), { recursive: true })

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getImageUploadDir())
  },
  filename(req, file, cb) {
    cb(null, buildImageFilename(req.user.id, file))
  },
})

function imageFileFilter(req, file, cb) {
  if (!isAllowedImage(file)) {
    const error = new Error('只支持 jpg、png、webp 图片')
    error.status = 400
    error.code = 40010
    cb(error)
    return
  }

  cb(null, true)
}

const uploadImageFile = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: maxImageSizeBytes,
    files: 1,
  },
}).single('file')

module.exports = {
  uploadImageFile,
}
