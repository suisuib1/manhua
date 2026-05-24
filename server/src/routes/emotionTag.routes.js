const express = require('express')
const { getEmotionTags } = require('../controllers/emotionTag.controller')

const router = express.Router()

router.get('/emotion-tags', getEmotionTags)

module.exports = router
