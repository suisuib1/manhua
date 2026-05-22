const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  listRecentComicChapters,
} = require('../controllers/comicChapter.controller')

const router = express.Router()

router.use(authMiddleware)
router.get('/recent', listRecentComicChapters)

module.exports = router
