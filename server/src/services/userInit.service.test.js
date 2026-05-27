const assert = require('node:assert/strict')
const test = require('node:test')

function createFakePrisma() {
  const users = []
  const profiles = []
  let nextUserIndex = 1

  const userApi = {
    async findUnique({ where }) {
      const user = users.find((item) => {
        if (where.id) return item.id === where.id
        return item.wxOpenid === where.wxOpenid
      })

      if (!user) return null

      return attachProfile(user)
    },
    async create({ data }) {
      const user = Object.assign({
        id: `user-${nextUserIndex++}`,
        profile: null,
      }, data)
      users.push(user)
      return attachProfile(user)
    },
    async update({ where, data }) {
      const user = users.find((item) => item.id === where.id)
      Object.assign(user, data)
      return attachProfile(user)
    },
  }

  const userProfileApi = {
    async create({ data }) {
      profiles.push(Object.assign({}, data))
      return data
    },
    async update({ where, data }) {
      const profile = profiles.find((item) => item.userId === where.userId)
      Object.assign(profile, data)
      return profile
    },
  }

  function attachProfile(user) {
    const profile = profiles.find((item) => item.userId === user.id) || null
    return Object.assign({}, user, {
      profile,
    })
  }

  return {
    user: userApi,
    userProfile: userProfileApi,
    userSetting: { async create() {} },
    comicBook: { async create() {} },
    userQuota: { async create() {} },
    async $transaction(callback) {
      return callback({
        user: userApi,
        userProfile: userProfileApi,
        userSetting: this.userSetting,
        comicBook: this.comicBook,
        userQuota: this.userQuota,
      })
    },
    counts() {
      return {
        users: users.length,
      }
    },
  }
}

function snapshotModules(paths) {
  return paths.map((path) => [path, require.cache[path]])
}

function restoreModules(snapshot) {
  snapshot.forEach(([path, entry]) => {
    if (entry) {
      require.cache[path] = entry
    } else {
      delete require.cache[path]
    }
  })
}

function loadUserInitServiceWithFakePrisma(prisma) {
  const prismaPath = require.resolve('../utils/prisma')
  const servicePath = require.resolve('./userInit.service')
  const moduleSnapshot = snapshotModules([prismaPath, servicePath])

  delete require.cache[servicePath]
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: {
      prisma,
    },
  }

  return {
    service: require('./userInit.service'),
    restore() {
      restoreModules(moduleSnapshot)
    },
  }
}

test('同一个真实 openid 二次登录不会创建新用户', async () => {
  const prisma = createFakePrisma()
  const { service, restore } = loadUserInitServiceWithFakePrisma(prisma)

  try {
    const first = await service.findOrCreateUserByWechatIdentity({
      openid: 'openid-real-user',
      unionid: 'union-real-user',
      profile: {
        nickname: '小满',
        avatarUrl: '/avatar.png',
      },
    })
    const second = await service.findOrCreateUserByWechatIdentity({
      openid: 'openid-real-user',
      unionid: 'union-real-user',
      profile: {},
    })

    assert.equal(first.isNewUser, true)
    assert.equal(second.isNewUser, false)
    assert.equal(first.user.id, second.user.id)
    assert.equal(prisma.counts().users, 1)
    assert.equal(second.user.wxOpenid, 'openid-real-user')
  } finally {
    restore()
  }
})
