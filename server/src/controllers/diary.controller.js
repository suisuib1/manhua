const { success } = require('../utils/response')
const {
  createEntry,
  listEntries,
  getEntryById,
  updateEntry,
  softDeleteEntry,
} = require('../services/diary.service')

async function createDiaryEntry(req, res, next) {
  try {
    const data = await createEntry(req.user.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function listDiaryEntries(req, res, next) {
  try {
    const data = await listEntries(req.user.id, req.query || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function getDiaryEntry(req, res, next) {
  try {
    const data = await getEntryById(req.user.id, req.params.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function updateDiaryEntry(req, res, next) {
  try {
    const data = await updateEntry(req.user.id, req.params.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function deleteDiaryEntry(req, res, next) {
  try {
    const data = await softDeleteEntry(req.user.id, req.params.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  createDiaryEntry,
  listDiaryEntries,
  getDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
}
