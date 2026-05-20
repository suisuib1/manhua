const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const { uploadImage } = require('../controllers/upload.controller')

const router = express.Router()

router.use(authMiddleware)
router.post('/images', uploadImage)

module.exports = router
