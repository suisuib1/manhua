const { success } = require('../utils/response')
const {
  getAdminCharacterProfileDetail,
  listAdminCharacterProfiles,
} = require('../services/adminCharacterProfile.service')

async function listCharacterProfiles(req, res, next) {
  try {
    return success(res, await listAdminCharacterProfiles(req.query || {}))
  } catch (err) {
    return next(err)
  }
}

async function getCharacterProfile(req, res, next) {
  try {
    return success(res, await getAdminCharacterProfileDetail(req.params.id))
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  getCharacterProfile,
  listCharacterProfiles,
}
