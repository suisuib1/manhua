const { success } = require('../utils/response')
const {
  getAdminComicChapterDetail,
  listAdminComicChapters,
} = require('../services/adminComicChapter.service')

async function listChapters(req, res, next) {
  try {
    return success(res, await listAdminComicChapters(req.query || {}))
  } catch (err) {
    return next(err)
  }
}

async function getChapter(req, res, next) {
  try {
    return success(res, await getAdminComicChapterDetail(req.params.diaryEntryId))
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getChapter,
  listChapters,
}
