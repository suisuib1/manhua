async function code2session(code) {
  if (shouldUseMockLogin()) {
    return {
      openid: `mock_openid_${code}`,
      unionid: null,
    }
  }

  return requestWechatCode2Session(code)
}

function shouldUseMockLogin() {
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  return process.env.WECHAT_LOGIN_MOCK === 'true'
}

async function requestWechatCode2Session(code) {
  const appId = process.env.WECHAT_APP_ID
  const appSecret = process.env.WECHAT_APP_SECRET

  if (!appId || !appSecret) {
    const error = new Error('微信登录服务未配置')
    error.status = 500
    error.code = 50002
    throw error
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appId)
  url.searchParams.set('secret', appSecret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  let response
  try {
    response = await fetch(url)
  } catch (err) {
    const error = new Error('微信登录服务暂不可用')
    error.status = 502
    error.code = 50201
    throw error
  }

  if (!response.ok) {
    const error = new Error('微信登录服务暂不可用')
    error.status = 502
    error.code = 50201
    throw error
  }

  const data = await response.json()

  if (!data.openid) {
    const error = new Error('微信登录凭证无效')
    error.status = 401
    error.code = 40101
    throw error
  }

  return {
    openid: data.openid,
    unionid: data.unionid || null,
  }
}

module.exports = {
  code2session,
}
