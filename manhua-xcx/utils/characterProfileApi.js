const { request } = require('./api')

const allowedProfileFields = [
  'nickname',
  'roleTitle',
  'description',
  'personalityText',
  'appearanceText',
  'referenceImageUrl',
]

function pickAllowedProfileFields(profile) {
  const data = {}

  for (const field of allowedProfileFields) {
    if (Object.prototype.hasOwnProperty.call(profile || {}, field)) {
      data[field] = profile[field]
    }
  }

  return data
}

function getCharacterProfile() {
  return request({
    url: '/api/users/me/character-profile',
    method: 'GET',
    auth: true,
  })
}

function saveCharacterProfile(profile) {
  return request({
    url: '/api/users/me/character-profile',
    method: 'PUT',
    data: pickAllowedProfileFields(profile),
    auth: true,
  })
}

module.exports = {
  getCharacterProfile,
  pickAllowedProfileFields,
  saveCharacterProfile,
}
