const test = require('node:test')
const assert = require('node:assert/strict')

const { app } = require('../src/app')

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server))
    server.on('error', reject)
  })
}

test('GET /api/health returns service status', async () => {
  const server = await listen(app)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.message, 'ok')
    assert.equal(body.data.status, 'ok')
    assert.equal(body.data.service, 'manhua-api')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('unknown route returns 404 JSON response', async () => {
  const server = await listen(app)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/unknown`)
    const body = await response.json()

    assert.equal(response.status, 404)
    assert.equal(body.code, 404)
    assert.equal(body.message, '接口不存在')
    assert.equal(body.data, null)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
