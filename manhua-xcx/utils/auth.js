const { request } = require('./api')
const { storageKeys } = require('./mock')

function getAuthToken() {
  return wx.getStorageSync(storageKeys.authToken) || ''
}

function getCurrentUser() {
  return wx.getStorageSync(storageKeys.currentUser) || null
}

function saveAuthSession(token, user) {
  wx.setStorageSync(storageKeys.authToken, token)
  wx.setStorageSync(storageKeys.currentUser, user)
}

function clearAuthSession() {
  wx.removeStorageSync(storageKeys.authToken)
  wx.removeStorageSync(storageKeys.currentUser)
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res && res.code) {
          resolve(res.code)
          return
        }

        reject(new Error('缺少微信登录凭证'))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

function normalizeUserFromBundle(bundle) {
  const profile = bundle && bundle.profile ? bundle.profile : {}
  const user = bundle && bundle.user ? bundle.user : {}

  return {
    id: user.id,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    nickname: profile.nickname || '',
    avatarUrl: profile.avatarUrl || '',
    bio: profile.bio || '',
  }
}

async function loginWithWechat(profile = {}) {
  const code = await wxLogin()
  const data = await request({
    url: '/api/auth/wechat/login',
    method: 'POST',
    data: {
      code,
      profile,
    },
  })

  saveAuthSession(data.token, data.user)
  return data.user
}

async function refreshCurrentUser() {
  const bundle = await request({
    url: '/api/users/me',
    method: 'GET',
    auth: true,
  })
  const user = normalizeUserFromBundle(bundle)
  wx.setStorageSync(storageKeys.currentUser, user)
  return {
    bundle,
    user,
  }
}

module.exports = {
  getAuthToken,
  getCurrentUser,
  saveAuthSession,
  clearAuthSession,
  loginWithWechat,
  refreshCurrentUser,
}
