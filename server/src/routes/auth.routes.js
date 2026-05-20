const express = require('express')
const { loginWithWechat } = require('../controllers/auth.controller')

const router = express.Router()

router.post('/wechat/login', loginWithWechat)

module.exports = router
