const { getCurrentUser } = require('../../utils/auth')

const defaultProfile = {
  nickname: '漫画日记用户',
  subtitle: '记录生活，收藏回忆',
  username: 'manhua_user',
  birthday: '2000-05-20',
  region: '广东省 深圳市',
  avatar: '/subpackage/icon-home-mascot-star.png',
}

function buildProfile(user) {
  if (!user || !user.id) {
    return Object.assign({}, defaultProfile)
  }

  return Object.assign({}, defaultProfile, {
    nickname: user.nickname || defaultProfile.nickname,
    avatar: user.avatarUrl || defaultProfile.avatar,
  })
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
}
