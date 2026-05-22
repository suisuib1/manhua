const { request } = require('./api')

function getRecentComicChapters(options = {}) {
  return request({
    url: '/api/comic-chapters/recent',
    method: 'GET',
    data: Object.prototype.hasOwnProperty.call(options, 'limit') ? {
      limit: options.limit,
    } : undefined,
    auth: true,
  })
}

module.exports = {
  getRecentComicChapters,
}
