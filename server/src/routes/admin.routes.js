const express = require('express')
const adminAuthMiddleware = require('../middleware/adminAuth.middleware')
const {
  dashboard,
  login,
  me,
} = require('../controllers/admin.controller')

const router = express.Router()

router.post('/auth/login', login)
router.get('/me', adminAuthMiddleware, me)
router.get('/dashboard', adminAuthMiddleware, dashboard)

module.exports = router
