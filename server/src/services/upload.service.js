const path = require('node:path')

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const allowedImageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
])

const maxImageSizeBytes = 5 * 1024 * 1024

function getUploadRoot() {
  return path.join(__dirname, '..', '..', 'uploads')
}

function getImageUploadDir() {
  return path.join(getUploadRoot(), 'images')
}

function getSafeImageExtension(file) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase()

  if (allowedImageExtensions.has(originalExtension)) {
    return originalExtension
  }

  if (file.mimetype === 'image/jpeg') return '.jpg'
  if (file.mimetype === 'image/png') return '.png'
  if (file.mimetype === 'image/webp') return '.webp'

  return ''
}

function isAllowedImage(file) {
  const originalExtension = path.extname(file.originalname || '').toLowerCase()
  return allowedImageMimeTypes.has(file.mimetype) && allowedImageExtensions.has(originalExtension)
}

function buildImageFilename(userId, file) {
  const extension = getSafeImageExtension(file)
  const random = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${userId}-${random}${extension}`
}

function buildUploadedImageResponse(file) {
  return {
    url: `/uploads/images/${file.filename}`,
    filename: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  }
}

module.exports = {
  allowedImageMimeTypes,
  allowedImageExtensions,
  maxImageSizeBytes,
  getUploadRoot,
  getImageUploadDir,
  getSafeImageExtension,
  isAllowedImage,
  buildImageFilename,
  buildUploadedImageResponse,
}
