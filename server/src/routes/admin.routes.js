const express = require('express')
const adminAuthMiddleware = require('../middleware/adminAuth.middleware')
const {
  dashboard,
  login,
  me,
} = require('../controllers/admin.controller')
const {
  getTask,
  listTasks,
} = require('../controllers/adminGenerationTask.controller')
const {
  getChapter,
  listChapters,
} = require('../controllers/adminComicChapter.controller')

const router = express.Router()

router.post('/auth/login', login)
router.get('/me', adminAuthMiddleware, me)
router.get('/dashboard', adminAuthMiddleware, dashboard)
router.get('/generation-tasks', adminAuthMiddleware, listTasks)
router.get('/generation-tasks/:id', adminAuthMiddleware, getTask)
router.get('/comic-chapters', adminAuthMiddleware, listChapters)
router.get('/comic-chapters/:diaryEntryId', adminAuthMiddleware, getChapter)

module.exports = router
