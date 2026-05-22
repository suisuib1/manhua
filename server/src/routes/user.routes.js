const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  getMe,
  updateProfile,
  getSettings,
  updateSettings,
  getCharacterProfile,
  updateCharacterProfile,
} = require('../controllers/user.controller')

const router = express.Router()

router.use(authMiddleware)
router.get('/me', getMe)
router.put('/me/profile', updateProfile)
router.get('/me/settings', getSettings)
router.put('/me/settings', updateSettings)
router.get('/me/character-profile', getCharacterProfile)
router.put('/me/character-profile', updateCharacterProfile)

module.exports = router
