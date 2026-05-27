const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  listRecentComicChapters,
  getComicChapterStats,
} = require('../controllers/comicChapter.controller')

const router = express.Router()

router.use(authMiddleware)
router.get('/recent', listRecentComicChapters)
router.get('/stats', getComicChapterStats)

module.exports = router
