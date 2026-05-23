const { prisma } = require('../utils/prisma')
const {
  generateImageFromPrompt,
  hasOpenAiImageConfig,
} = require('./openaiImage.service')

async function createGenerationTask(ownerUserId, input) {
  const diaryEntryId = assertRequiredString(input.diaryEntryId, 'diaryEntryId is required')
  const diaryEntry = await findOwnedDiaryEntry(ownerUserId, diaryEntryId)
  const taskInput = buildTaskInput(diaryEntry)

  if (!hasOpenAiImageConfig()) {
    const now = new Date()
    const result = buildMockResult(diaryEntry)
    const task = await prisma.generationTask.create({
      data: {
        ownerUserId,
        diaryEntryId: diaryEntry.id,
        taskType: 'diary_to_comic',
        status: 'completed',
        promptSnapshot: buildMockPrompt(diaryEntry),
        inputJson: JSON.stringify(taskInput),
        resultJson: JSON.stringify(result),
        errorMessage: null,
        startedAt: now,
        finishedAt: now,
      },
    })

    return formatTask(task)
  }

  const task = await prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId: diaryEntry.id,
      taskType: 'diary_to_comic',
      status: 'pending',
      promptSnapshot: null,
      inputJson: JSON.stringify(taskInput),
      resultJson: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    },
  })

  scheduleGenerationTask(task.id, ownerUserId, diaryEntry.id)

  return formatTask(task)
}

async function getGenerationTask(ownerUserId, id) {
  const task = await prisma.generationTask.findFirst({
    where: {
      id,
      ownerUserId,
      deletedAt: null,
    },
  })

  if (!task) {
    throwNotFound()
  }

  return formatTask(task)
}

async function findOwnedDiaryEntry(ownerUserId, diaryEntryId) {
  const diaryEntry = await prisma.diaryEntry.findFirst({
    where: {
      id: diaryEntryId,
      ownerUserId,
      deletedAt: null,
    },
  })

  if (!diaryEntry) {
    throwNotFound()
  }

  return diaryEntry
}

async function findCharacterProfile(ownerUserId) {
  if (!prisma.characterProfile) {
    return null
  }

  return prisma.characterProfile.findUnique({
    where: {
      ownerUserId,
    },
  })
}

function scheduleGenerationTask(taskId, ownerUserId, diaryEntryId) {
  setImmediate(() => {
    runGenerationTask(taskId, ownerUserId, diaryEntryId).catch((err) => {
      warnGenerationTaskUpdateFailure(err)
    })
  })
}

async function runGenerationTask(taskId, ownerUserId, diaryEntryId) {
  const diaryEntry = await findOwnedDiaryEntry(ownerUserId, diaryEntryId)
  const characterProfile = await findCharacterProfile(ownerUserId)
  const prompt = buildOpenAiPrompt(diaryEntry, characterProfile)
  const startedAt = new Date()

  await updateGenerationTaskSafely(taskId, {
    status: 'processing',
    promptSnapshot: prompt,
    errorMessage: null,
    startedAt,
  })

  try {
    const image = await generateImageFromPrompt(prompt)
    await updateGenerationTaskSafely(taskId, {
      status: 'completed',
      resultJson: JSON.stringify(buildOpenAiResult(diaryEntry, image)),
      errorMessage: null,
      finishedAt: new Date(),
    })
  } catch (err) {
    warnOpenAiFallback(err)
    await updateGenerationTaskSafely(taskId, {
      status: 'failed',
      errorMessage: sanitizeGenerationError(err),
      finishedAt: new Date(),
    })
  }
}

async function updateGenerationTaskSafely(taskId, data) {
  try {
    return await prisma.generationTask.update({
      where: {
        id: taskId,
      },
      data,
    })
  } catch (err) {
    warnGenerationTaskUpdateFailure(err)
    return null
  }
}

function buildTaskInput(diaryEntry) {
  return {
    diaryEntryId: diaryEntry.id,
    chapterTitle: diaryEntry.chapterTitle,
    diaryDate: diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString() : null,
    diaryTextSummary: summarizeText(diaryEntry.diaryText),
    pageCount: diaryEntry.pageCount,
    pageMode: diaryEntry.pageMode,
    selectedTags: parseJsonArray(diaryEntry.selectedTagsJson),
  }
}

function buildMockResult(diaryEntry) {
  const title = diaryEntry.chapterTitle || 'Untitled chapter'

  return {
    chapter: {
      diaryEntryId: diaryEntry.id,
      title,
      date: diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString() : null,
      source: 'mock',
    },
    pages: [
      {
        pageIndex: 0,
        sortOrder: 0,
        caption: 'mock comic page',
        imageUrl: null,
        mock: true,
      },
    ],
  }
}

function buildMockPrompt(diaryEntry) {
  const title = diaryEntry.chapterTitle || 'Untitled chapter'
  return `Mock Q-style comic generation prompt: ${title}`
}

function buildOpenAiPrompt(diaryEntry, characterProfile) {
  const selectedTags = parseJsonArray(diaryEntry.selectedTagsJson).join(', ') || 'daily, healing'
  const chapterTitle = limitText(diaryEntry.chapterTitle, 80) || '未命名章节'
  const diaryDate = diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString().slice(0, 10) : '未填写'
  const diarySummary = limitText(diaryEntry.diaryText, 240) || '今天的生活片段'
  const characterLines = buildCharacterPromptLines(characterProfile)

  return [
    '你是一名温暖治愈系 Q 版漫画插画师。',
    '',
    '【画面目标】',
    '请生成一张单页漫画插图，本轮只生成第一页，不做多页连续漫画。',
    '风格必须是 Q 版、chibi、温暖治愈、儿童绘本感、柔和线条、明亮干净配色。',
    '画面包含 3-4 个清晰分镜，围绕主角今天的一个日常小故事展开。',
    '主角在每个分镜中保持同一发型、服装、五官和整体形象一致。',
    '',
    '【主角设定】',
    ...characterLines,
    '',
    '【章节信息】',
    `章节标题：${chapterTitle}`,
    `日记日期：${diaryDate}`,
    `情绪标签：${selectedTags}`,
    '页数说明：本轮只生成第一页/单页插图。',
    '',
    '【日记摘要】',
    diarySummary,
    '',
    '【禁止项】',
    '不要真实照片风，不要水印，不要 logo，不要复杂文字，不要对话框，不要大段文字。',
    '不要输出文字说明，不要包含真实隐私信息。',
  ].join('\n')
}

function buildCharacterPromptLines(characterProfile) {
  const profile = characterProfile || {}
  return [
    `昵称：${limitText(profile.nickname, 30) || '日记主人公'}`,
    `身份：${limitText(profile.roleTitle, 50) || '私人漫画书主角'}`,
    `性格：${limitText(profile.personalityText, 120) || '温柔、好奇、安静可爱'}`,
    `外观：${limitText(profile.appearanceText, 160) || 'Q 版大头小身比例，圆润五官，表情柔和'}`,
    `补充：${limitText(profile.description, 120) || '保持角色形象统一'}`,
  ]
}

function buildOpenAiResult(diaryEntry, image) {
  const title = diaryEntry.chapterTitle || 'Untitled chapter'

  return {
    chapter: {
      diaryEntryId: diaryEntry.id,
      title,
      date: diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString() : null,
      source: 'openai',
    },
    pages: [
      {
        pageIndex: 0,
        sortOrder: 0,
        caption: '根据日记内容生成的第一页漫画',
        imageUrl: image.imageUrl,
        mock: false,
      },
    ],
  }
}

function warnOpenAiFallback(err) {
  console.warn('[generation-task-openai-fallback]', {
    name: err && err.name ? err.name : 'Error',
    code: err && err.code ? err.code : undefined,
    message: err && err.message ? err.message : 'OpenAI image generation failed',
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    size: process.env.OPENAI_IMAGE_SIZE || '1024x1024',
  })
}

function warnGenerationTaskUpdateFailure(err) {
  console.warn('[generation-task-update-failed]', {
    name: err && err.name ? err.name : 'Error',
    code: err && err.code ? err.code : undefined,
    message: err && err.message ? err.message : 'Generation task update failed',
  })
}

function sanitizeGenerationError(err) {
  const message = err && err.message ? err.message : 'OpenAI image generation failed'
  return String(message).slice(0, 200)
}

function summarizeText(value) {
  if (!value) return ''
  return String(value).slice(0, 80)
}

function limitText(value, maxLength) {
  if (!value) return ''
  return String(value).trim().slice(0, maxLength)
}

function formatTask(task) {
  return {
    id: task.id,
    status: task.status,
    taskType: task.taskType,
    diaryEntryId: task.diaryEntryId,
    input: parseJsonObject(task.inputJson),
    result: parseJsonObject(task.resultJson),
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (err) {
    return {}
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    return []
  }
}

function assertRequiredString(value, message) {
  if (typeof value !== 'string' || value.length === 0) {
    const error = new Error(message)
    error.status = 400
    error.code = 40001
    throw error
  }

  return value
}

function throwNotFound() {
  const error = new Error('Generation task or diary entry not found')
  error.status = 404
  error.code = 404
  throw error
}

module.exports = {
  createGenerationTask,
  getGenerationTask,
}
