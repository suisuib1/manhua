const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  createDiaryEntry,
  listDiaryEntries,
  getDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
} = require('../controllers/diary.controller')

const router = express.Router()

router.use(authMiddleware)
router.post('/', createDiaryEntry)
router.get('/', listDiaryEntries)
router.get('/:id', getDiaryEntry)
router.put('/:id', updateDiaryEntry)
router.delete('/:id', deleteDiaryEntry)

module.exports = router
