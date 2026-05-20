const assert = require('node:assert/strict')
const test = require('node:test')

const originalConsole = console

function loadUploadApi(storage = {}, uploadImpl) {
  const uploadCalls = []
  const logCalls = []

  global.console = Object.assign({}, originalConsole, {
    log(...args) {
      logCalls.push(args)
    },
  })

  global.wx = {
    getStorageSync(key) {
      return storage[key]
    },
    uploadFile(options) {
      uploadCalls.push(options)
      uploadImpl(options)
    },
  }

  delete require.cache[require.resolve('./uploadApi')]
  const uploadApi = require('./uploadApi')

  return {
    uploadApi,
    uploadCalls,
    logCalls,
  }
}

test('uploadImage uses wx.uploadFile with auth header and parses success response', async () => {
  const { uploadApi, uploadCalls, logCalls } = loadUploadApi({
    authToken: 'token-upload-api',
  }, (options) => {
    options.success({
      statusCode: 200,
      data: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          url: '/uploads/images/a.jpg',
          filename: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 100,
        },
      }),
    })
  })

  const data = await uploadApi.uploadImage('wxfile://a.jpg')

  assert.equal(uploadCalls[0].url, 'http://127.0.0.1:3000/api/uploads/images')
  assert.equal(uploadCalls[0].filePath, 'wxfile://a.jpg')
  assert.equal(uploadCalls[0].name, 'file')
  assert.equal(uploadCalls[0].header.Authorization, 'Bearer token-upload-api')
  assert.equal(data.url, '/uploads/images/a.jpg')
  assert.equal(logCalls.length, 0)
})

test('uploadImage rejects backend non-zero response and network failure', async () => {
  const backendFailure = loadUploadApi({
    authToken: 'token-upload-api',
  }, (options) => {
    options.success({
      statusCode: 400,
      data: JSON.stringify({
        code: 40010,
        message: '只支持图片',
        data: null,
      }),
    })
  })

  await assert.rejects(
    () => backendFailure.uploadApi.uploadImage('wxfile://a.txt'),
    /只支持图片/
  )

  const networkFailure = loadUploadApi({
    authToken: 'token-upload-api',
  }, (options) => {
    options.fail({
      errMsg: 'uploadFile:fail',
    })
  })

  await assert.rejects(
    () => networkFailure.uploadApi.uploadImage('wxfile://a.jpg'),
    /uploadFile:fail/
  )
})

test.afterEach(() => {
  global.console = originalConsole
})
