const { success } = require('../utils/response')
const { listEmotionTags } = require('../services/emotionTag.service')

function getEmotionTags(req, res) {
  return success(res, listEmotionTags())
}

module.exports = {
  getEmotionTags,
}
