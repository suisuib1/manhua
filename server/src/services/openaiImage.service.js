const fs = require('node:fs/promises')
const path = require('node:path')

const defaultBaseUrl = 'https://api.openai.com/v1'
const defaultModel = 'gpt-image-1'
const defaultSize = '1024x1024'
const defaultTimeoutMs = 60000

function hasOpenAiImageConfig() {
  return Boolean(process.env.OPENAI_API_KEY)
}

async function generateImageFromPrompt(prompt) {
  const config = getOpenAiConfig()
  logOpenAiEvent('request-start', config)
  const responseBody = await requestImageGeneration(prompt, config)
  const image = pickImageResult(responseBody)
  logOpenAiEvent('download-start', config, { source: image.b64_json ? 'b64' : 'url' })
  const imageBuffer = await resolveImageBuffer(image, config)
  const saved = await saveGeneratedImage(imageBuffer)
  logOpenAiEvent('image-save-success', config, { imageUrl: saved.imageUrl })

  return {
    imageUrl: saved.imageUrl,
    revisedPrompt: image.revised_prompt || image.revisedPrompt || '',
    providerMeta: {
      provider: 'openai',
      model: config.model,
      size: config.size,
    },
  }
}

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured')
    error.code = 'OPENAI_NOT_CONFIGURED'
    throw error
  }

  return {
    apiKey,
    baseUrl: trimTrailingSlash(process.env.OPENAI_BASE_URL || defaultBaseUrl),
    model: process.env.OPENAI_IMAGE_MODEL || defaultModel,
    size: process.env.OPENAI_IMAGE_SIZE || defaultSize,
    quality: process.env.OPENAI_IMAGE_QUALITY || '',
    style: process.env.OPENAI_IMAGE_STYLE || '',
    timeoutMs: toPositiveInteger(process.env.OPENAI_TIMEOUT_MS, defaultTimeoutMs),
  }
}

async function requestImageGeneration(prompt, config) {
  const body = {
    model: config.model,
    prompt,
    size: config.size,
    n: 1,
  }

  if (config.quality) body.quality = config.quality
  if (config.style) body.style = config.style

  return withAbortTimeout(async (signal) => {
    try {
      const response = await fetch(`${config.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        throw new Error(`OpenAI image generation failed with status ${response.status}`)
      }

      return response.json()
    } finally {
      logOpenAiEvent('request-end', config)
    }
  }, config.timeoutMs, 'OpenAI image generation timed out')
}

function pickImageResult(responseBody) {
  const image = responseBody && Array.isArray(responseBody.data) ? responseBody.data[0] : null

  if (!image || (!image.b64_json && !image.url)) {
    throw new Error('OpenAI image generation returned no image')
  }

  return image
}

async function resolveImageBuffer(image, config) {
  if (image.b64_json) {
    return Buffer.from(image.b64_json, 'base64')
  }

  return withAbortTimeout(async (signal) => {
    const response = await fetch(image.url, {
      method: 'GET',
      signal,
    })

    if (!response.ok) {
      throw new Error(`OpenAI generated image download failed with status ${response.status}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }, config.timeoutMs, 'OpenAI image download timed out')
}

async function saveGeneratedImage(imageBuffer) {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Generated image is empty')
  }

  const uploadDir = getGeneratedUploadDir()
  await fs.mkdir(uploadDir, { recursive: true })

  const filename = buildGeneratedImageFilename()
  const filePath = path.join(uploadDir, filename)
  await fs.writeFile(filePath, imageBuffer)

  return {
    imageUrl: `/uploads/generated/${filename}`,
    filename,
  }
}

function getGeneratedUploadDir() {
  return path.join(__dirname, '..', '..', 'uploads', 'generated')
}

function buildGeneratedImageFilename() {
  const random = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `openai-${random}.png`
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, Object.assign({}, options, {
      signal: controller.signal,
    }))
  } finally {
    clearTimeout(timer)
  }
}

function withAbortTimeout(callback, timeoutMs, message) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  return Promise.resolve()
    .then(() => callback(controller.signal))
    .catch((err) => {
      if (controller.signal.aborted) {
        const error = new Error(message)
        error.name = 'TimeoutError'
        error.code = 'OPENAI_TIMEOUT'
        throw error
      }
      throw err
    })
    .finally(() => {
      clearTimeout(timer)
    })
}

function logOpenAiEvent(event, config, extra = {}) {
  console.info('[openai-image]', Object.assign({
    event,
    model: config.model,
    size: config.size,
  }, extra))
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}

function toPositiveInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback
}

module.exports = {
  generateImageFromPrompt,
  hasOpenAiImageConfig,
}
