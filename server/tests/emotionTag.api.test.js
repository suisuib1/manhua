const test = require('node:test')
const assert = require('node:assert/strict')

const { app } = require('../src/app')

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = appInstance.listen(0, () => resolve(server))
    server.on('error', reject)
  })
}

test('GET /api/emotion-tags returns public emotion tag list', async () => {
  const server = await listen(app)

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}/api/emotion-tags`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.code, 0)
    assert.equal(body.message, 'ok')
    assert.equal(Array.isArray(body.data.items), true)
    assert.deepEqual(body.data.items[0], {
      key: 'warm',
      label: '温暖',
    })
    assert.equal(body.data.items.some((item) => item.key === 'cute'), true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
