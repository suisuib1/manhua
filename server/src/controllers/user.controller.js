const { success } = require('../utils/response')
const {
  getCurrentUserBundle,
  updateCurrentUserProfile,
  getCurrentUserSettings,
  updateCurrentUserSettings,
  getCurrentUserCharacterProfile,
  updateCurrentUserCharacterProfile,
} = require('../services/user.service')

async function getMe(req, res, next) {
  try {
    const data = await getCurrentUserBundle(req.user.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function updateProfile(req, res, next) {
  try {
    const data = await updateCurrentUserProfile(req.user.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function getSettings(req, res, next) {
  try {
    const data = await getCurrentUserSettings(req.user.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await updateCurrentUserSettings(req.user.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function getCharacterProfile(req, res, next) {
  try {
    const data = await getCurrentUserCharacterProfile(req.user.id)
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

async function updateCharacterProfile(req, res, next) {
  try {
    const data = await updateCurrentUserCharacterProfile(req.user.id, req.body || {})
    return success(res, data)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getMe,
  updateProfile,
  getSettings,
  updateSettings,
  getCharacterProfile,
  updateCharacterProfile,
}
