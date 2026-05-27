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

function getComicChapterStats() {
  return request({
    url: '/api/comic-chapters/stats',
    method: 'GET',
    auth: true,
  })
}

module.exports = {
  getRecentComicChapters,
  getComicChapterStats,
}
