const { request } = require('./api')

function getEmotionTags() {
  return request({
    url: '/api/emotion-tags',
    method: 'GET',
  })
}

module.exports = {
  getEmotionTags,
}
