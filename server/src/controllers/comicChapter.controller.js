const { success } = require('../utils/response')
const {
  listRecentChapters,
  getComicChapterStats,
} = require('../services/comicChapter.service')

async function listRecentComicChapters(req, res, next) {
  try {
    const data = await listRecentChapters(req.user.id, req.query || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function getComicChapterStatsController(req, res, next) {
  try {
    const data = await getComicChapterStats(req.user.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  listRecentComicChapters,
  getComicChapterStats: getComicChapterStatsController,
}
