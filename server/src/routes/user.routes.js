const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  getMe,
  updateProfile,
  getSettings,
  updateSettings,
} = require('../controllers/user.controller')

const router = express.Router()

router.use(authMiddleware)
router.get('/me', getMe)
router.put('/me/profile', updateProfile)
router.get('/me/settings', getSettings)
router.put('/me/settings', updateSettings)

module.exports = router
