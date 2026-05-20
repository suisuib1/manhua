const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

process.env.JWT_SECRET = 'test_issue10_jwt_secret'
process.env.JWT_EXPIRES_IN = '7d'
process.env.WECHAT_LOGIN_MOCK = 'true'

const { clearCoreTables } = require('./helpers/testDatabase')
const { app } = require('../src/app')

const uploadRoot = path.join(__dirname, '..', 'uploads')
const imageUploadDir = path.join(uploadRoot, 'images')

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server))
    server.on('error', reject)
  })
}

async function postJson(server, pathName, body) {
  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}${pathName}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return {
    response,
    body: await response.json(),
  }
}

async function login(server, code = 'test_issue10_upload') {
  const { body } = await postJson(server, '/api/auth/wechat/login', {
    code,
    profile: {
      nickname: `${code}_user`,
    },
  })

  return body.data
}

async function uploadImage(server, token, file) {
  const { port } = server.address()
  const form = new FormData()
  form.append('file', file.blob, file.name)
  const headers = token ? { authorization: `Bearer ${token}` } : undefined
  const response = await fetch(`http://127.0.0.1:${port}/api/uploads/images`, {
    method: 'POST',
    headers,
    body: form,
  })

  return {
    response,
    body: await response.json(),
  }
}

function makeFile(mimeType, bytes, name) {
  return {
    name,
    blob: new Blob([bytes], { type: mimeType }),
  }
}

function tinyPngFile() {
  return makeFile('image/png', Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
  ]), 'avatar.png')
}

function listUploadedFiles() {
  if (!fs.existsSync(imageUploadDir)) return []
  return fs.readdirSync(imageUploadDir).map((filename) => path.join(imageUploadDir, filename))
}

test.beforeEach(async () => {
  await clearCoreTables()
})

test.afterEach(() => {
  for (const filePath of listUploadedFiles()) {
    fs.rmSync(filePath, { force: true })
  }
})

test('POST /api/uploads/images requires login', async () => {
  const server = await listen(app)

  try {
    const { response, body } = await uploadImage(server, null, tinyPngFile())

    assert.equal(response.status, 401)
    assert.equal(body.code, 401)
    assert.equal(body.data, null)
    assert.equal(listUploadedFiles().length, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('logged in user can upload an image and access returned url', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server)
    const { response, body } = await uploadImage(server, loginData.token, tinyPngFile())

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.data.url.startsWith('/uploads/images/'), true)
    assert.equal(body.data.filename.endsWith('.png'), true)
    assert.equal(body.data.mimeType, 'image/png')
    assert.equal(body.data.sizeBytes, 12)
    assert.equal(body.data.url.includes('D:'), false)
    assert.equal(body.data.url.includes('\\'), false)
    assert.equal(body.data.url.includes(uploadRoot), false)

    const { port } = server.address()
    const imageResponse = await fetch(`http://127.0.0.1:${port}${body.data.url}`)
    assert.equal(imageResponse.status, 200)
    assert.equal(imageResponse.headers.get('content-type').startsWith('image/png'), true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('non-image upload returns 400 and does not save a file', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue10_text')
    const file = makeFile('text/plain', Buffer.from('not an image'), 'note.txt')
    const { response, body } = await uploadImage(server, loginData.token, file)

    assert.equal(response.status, 400)
    assert.notEqual(body.code, 0)
    assert.equal(body.data, null)
    assert.equal(listUploadedFiles().length, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('oversized image upload returns 400 or 413 and does not save a file', async () => {
  const server = await listen(app)

  try {
    const loginData = await login(server, 'test_issue10_large')
    const file = makeFile('image/png', Buffer.alloc((5 * 1024 * 1024) + 1), 'large.png')
    const { response, body } = await uploadImage(server, loginData.token, file)

    assert.equal([400, 413].includes(response.status), true)
    assert.notEqual(body.code, 0)
    assert.equal(body.data, null)
    assert.equal(listUploadedFiles().length, 0)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
