const { success, fail } = require('../utils/response')
const { signUserToken } = require('../utils/jwt')
const { code2session } = require('../services/wechatAuth.service')
const { findOrCreateUserByWechatIdentity } = require('../services/userInit.service')

async function loginWithWechat(req, res, next) {
  try {
    const { code, profile } = req.body || {}

    if (!code) {
      return fail(res, 40001, '缺少登录凭证', 400)
    }

    const identity = await code2session(code)
    const { user, isNewUser } = await findOrCreateUserByWechatIdentity({
      openid: identity.openid,
      unionid: identity.unionid,
      profile: profile || {},
    })
    const token = signUserToken(user)

    return success(res, {
      token,
      user: {
        id: user.id,
        nickname: user.profile ? user.profile.nickname : null,
        avatarUrl: user.profile ? user.profile.avatarUrl : null,
      },
      isNewUser,
    })
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  loginWithWechat,
}
