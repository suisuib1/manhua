const express = require('express')
const authMiddleware = require('../middleware/auth.middleware')
const {
  createTask,
  getTask,
} = require('../controllers/generationTask.controller')

const router = express.Router()

router.use(authMiddleware)
router.post('/', createTask)
router.get('/:id', getTask)

module.exports = router
