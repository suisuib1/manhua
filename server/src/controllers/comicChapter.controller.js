const { success } = require('../utils/response')
const {
  listRecentChapters,
} = require('../services/comicChapter.service')

async function listRecentComicChapters(req, res, next) {
  try {
    const data = await listRecentChapters(req.user.id, req.query || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  listRecentComicChapters,
}
