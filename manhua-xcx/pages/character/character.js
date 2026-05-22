const { getAuthToken } = require('../../utils/auth')
const { getCharacterProfile, saveCharacterProfile } = require('../../utils/characterProfileApi')
const { characterMock } = require('../../utils/mock')

const defaultReferenceImage = '/subpackage/icon-home-mascot-star.png'
const localCharacterProfileKey = 'characterProfile'

function buildDefaultCharacterProfile() {
  return {
    nickname: characterMock.nickname,
    roleTitle: characterMock.relation,
    description: characterMock.description,
    personalityText: characterMock.personalityTags.map((tag) => tag.label).join('、'),
    appearanceText: characterMock.appearanceTags.map((tag) => tag.label).join('、'),
    referenceImageUrl: '',
  }
}

function isLocalTemporaryImageUrl(value) {
  if (!value) return false

  return /^wxfile:\/\//.test(value)
    || /^https?:\/\/tmp\//.test(value)
    || value.indexOf('/tmp/') === 0
    || value.indexOf('tmp/') === 0
    || value.indexOf('blob:') === 0
}

function buildPageData(profile) {
  const nextProfile = Object.assign(buildDefaultCharacterProfile(), profile || {})

  return {
    nickname: nextProfile.nickname || '',
    roleTitle: nextProfile.roleTitle || characterMock.relation,
    description: nextProfile.description || '',
    personalityText: nextProfile.personalityText || '',
    appearanceText: nextProfile.appearanceText || '',
    referenceImage: nextProfile.referenceImageUrl || defaultReferenceImage,
    referenceImageUrl: nextProfile.referenceImageUrl || '',
  }
}

function getLocalCharacterProfile() {
  return wx.getStorageSync(localCharacterProfileKey) || null
}

function setLocalCharacterProfile(profile) {
  wx.setStorageSync(localCharacterProfileKey, profile)
}

function buildSavePayload(data) {
  const referenceImageUrl = isLocalTemporaryImageUrl(data.referenceImage) || data.referenceImage === defaultReferenceImage
    ? data.referenceImageUrl
    : data.referenceImage

  return {
    nickname: data.nickname || '',
    roleTitle: data.roleTitle || characterMock.relation,
    description: data.description || '',
    personalityText: data.personalityText || '',
    appearanceText: data.appearanceText || '',
    referenceImageUrl: referenceImageUrl || '',
  }
}

Page({
  data: Object.assign({
    mock: characterMock,
  }, buildPageData(null)),

  async onLoad() {
    const localProfile = getLocalCharacterProfile()

    if (localProfile) {
      this.setData(buildPageData(localProfile))
    }

    if (!getAuthToken()) {
      return null
    }

    try {
      const profile = await getCharacterProfile()
      this.setData(buildPageData(profile))
      setLocalCharacterProfile(profile)
      return profile
    } catch (error) {
      return null
    }
  },

  onNicknameInput(event) {
    this.setData({
      nickname: event.detail.value,
    })
  },

  onDescriptionInput(event) {
    this.setData({
      description: event.detail.value,
    })
  },

  onPersonalityInput(event) {
    this.setData({
      personalityText: event.detail.value,
    })
  },

  onAppearanceInput(event) {
    this.setData({
      appearanceText: event.detail.value,
    })
  },

  chooseReferenceImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const firstFile = res.tempFiles && res.tempFiles[0]
        if (!firstFile) {
          return
        }

        this.setData({
          referenceImage: firstFile.tempFilePath,
        })
      },
    })
  },

  saveCharacter() {
    if (!getAuthToken()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return Promise.resolve(null)
    }

    const payload = buildSavePayload(this.data)

    return saveCharacterProfile(payload)
      .then((profile) => {
        const nextProfile = Object.assign({}, payload, profile || {})
        const nextData = buildPageData(nextProfile)

        if (isLocalTemporaryImageUrl(this.data.referenceImage)) {
          nextData.referenceImage = this.data.referenceImage
        }

        this.setData(nextData)
        setLocalCharacterProfile(nextProfile)
        wx.showToast({
          title: '保存成功',
          icon: 'none',
        })
        return nextProfile
      })
      .catch(() => {
        wx.showToast({
          title: '保存失败',
          icon: 'none',
        })
        return null
      })
  },
})

module.exports = {
  buildDefaultCharacterProfile,
  buildPageData,
  buildSavePayload,
  isLocalTemporaryImageUrl,
}
