const { getAuthToken, getCurrentUser } = require('../../utils/auth')
const { request } = require('../../utils/api')
const { storageKeys } = require('../../utils/mock')

const defaultProfile = {
  nickname: '漫画日记用户',
  subtitle: '记录生活，收藏回忆',
  username: 'manhua_user',
  birthday: '2000-05-20',
  region: '广东省 深圳市',
  bio: '',
  avatarUrl: '',
  avatar: '/subpackage/icon-home-mascot-star.png',
}

function buildProfile(user) {
  if (!user || !user.id) {
    return Object.assign({}, defaultProfile)
  }

  return Object.assign({}, defaultProfile, {
    nickname: user.nickname || defaultProfile.nickname,
    bio: user.bio || defaultProfile.bio,
    avatarUrl: user.avatarUrl || defaultProfile.avatarUrl,
    avatar: user.avatarUrl || defaultProfile.avatar,
  })
}

function isLocalAvatarPath(value) {
  if (!value) return false

  return /^wxfile:\/\//.test(value)
    || /^http:\/\/tmp\//.test(value)
    || /^https:\/\/tmp\//.test(value)
    || value.indexOf('/tmp/') === 0
    || value.indexOf('tmp/') === 0
    || value.indexOf('blob:') === 0
}

function getSaveableAvatarUrl(profile, user) {
  if (profile.avatarUrl && !isLocalAvatarPath(profile.avatarUrl)) {
    return profile.avatarUrl
  }

  if (profile.avatar && profile.avatar !== defaultProfile.avatar && !isLocalAvatarPath(profile.avatar)) {
    return profile.avatar
  }

  return user && user.avatarUrl ? user.avatarUrl : ''
}

function getMediaTempPath(result) {
  if (result && Array.isArray(result.tempFiles) && result.tempFiles[0]) {
    return result.tempFiles[0].tempFilePath || result.tempFiles[0].path || ''
  }

  if (result && Array.isArray(result.tempFilePaths)) {
    return result.tempFilePaths[0] || ''
  }

  return ''
}

Page({
  data: {
    profile: buildProfile(null),
  },

  onShow() {
    this.setData({
      profile: buildProfile(getCurrentUser()),
    })
  },

  handleEditTap() {
    wx.showToast({
      title: '编辑资料后续接入',
      icon: 'none',
    })
  },

  onNicknameInput(event) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        nickname: event && event.detail ? event.detail.value : '',
      }),
    })
  },

  onBioInput(event) {
    this.setData({
      profile: Object.assign({}, this.data.profile, {
        bio: event && event.detail ? event.detail.value : '',
      }),
    })
  },

  async handleSaveProfile() {
    const currentUser = getCurrentUser()

    if (!getAuthToken() || !currentUser || !currentUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      })
      return null
    }

    const profile = this.data.profile || {}
    const payload = {
      nickname: profile.nickname || '',
      bio: profile.bio || '',
    }
    const avatarUrl = getSaveableAvatarUrl(profile, currentUser)

    if (avatarUrl) {
      payload.avatarUrl = avatarUrl
    }

    try {
      const savedProfile = await request({
        url: '/api/users/me/profile',
        method: 'PUT',
        data: payload,
        auth: true,
      })
      const nextUser = Object.assign({}, currentUser, {
        nickname: savedProfile.nickname || payload.nickname,
        avatarUrl: savedProfile.avatarUrl || avatarUrl,
        bio: savedProfile.bio || payload.bio,
      })

      wx.setStorageSync(storageKeys.currentUser, nextUser)
      const nextProfile = buildProfile(nextUser)
      if (profile.avatar && isLocalAvatarPath(profile.avatar)) {
        nextProfile.avatar = profile.avatar
      }

      this.setData({
        profile: nextProfile,
      })
      wx.showToast({
        title: '已保存',
        icon: 'none',
      })
      return savedProfile
    } catch (error) {
      wx.showToast({
        title: '保存失败',
        icon: 'none',
      })
      return null
    }
  },

  handleAvatarTap() {
    const updateAvatar = (result) => {
      const avatar = getMediaTempPath(result)

      if (!avatar) return

      this.setData({
        profile: Object.assign({}, this.data.profile, { avatar }),
      })
    }

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: updateAvatar,
      })
      return
    }

    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: updateAvatar,
    })
  },
})

module.exports = {
  buildProfile,
  defaultProfile,
  getMediaTempPath,
  getSaveableAvatarUrl,
  isLocalAvatarPath,
}
