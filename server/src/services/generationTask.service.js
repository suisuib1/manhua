const { prisma } = require('../utils/prisma')
const {
  generateImageFromPrompt,
  hasOpenAiImageConfig,
} = require('./openaiImage.service')

async function createGenerationTask(ownerUserId, input) {
  const diaryEntryId = assertRequiredString(input.diaryEntryId, 'diaryEntryId is required')
  const diaryEntry = await findOwnedDiaryEntry(ownerUserId, diaryEntryId)
  const characterProfile = await findCharacterProfile(ownerUserId)
  const now = new Date()
  const taskInput = buildTaskInput(diaryEntry)
  const generation = await buildGenerationResult(diaryEntry, characterProfile)
  const result = generation.result

  const task = await prisma.generationTask.create({
    data: {
      ownerUserId,
      diaryEntryId: diaryEntry.id,
      taskType: 'diary_to_comic',
      status: 'completed',
      promptSnapshot: generation.prompt,
      inputJson: JSON.stringify(taskInput),
      resultJson: JSON.stringify(result),
      errorMessage: null,
      startedAt: now,
      finishedAt: now,
    },
  })

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

async function buildGenerationResult(diaryEntry, characterProfile) {
  const fallback = {
    prompt: buildMockPrompt(diaryEntry),
    result: buildMockResult(diaryEntry),
  }

  if (!hasOpenAiImageConfig()) {
    return fallback
  }

  const prompt = buildOpenAiPrompt(diaryEntry, characterProfile)

  try {
    const image = await generateImageFromPrompt(prompt)
    return {
      prompt,
      result: buildOpenAiResult(diaryEntry, image),
    }
  } catch (err) {
    return fallback
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
  const characterLines = characterProfile ? [
    characterProfile.nickname ? `主角昵称：${characterProfile.nickname}` : '',
    characterProfile.roleTitle ? `角色身份：${characterProfile.roleTitle}` : '',
    characterProfile.description ? `角色描述：${characterProfile.description}` : '',
    characterProfile.personalityText ? `性格关键词：${characterProfile.personalityText}` : '',
    characterProfile.appearanceText ? `外观特征：${characterProfile.appearanceText}` : '',
  ].filter(Boolean) : []

  return [
    '请生成一张 Q 版治愈风格的多格漫画图，适合作为私人日记漫画章节的第一页。',
    '画面需要可爱、温暖、日常，保持同一个主角形象一致。',
    `章节标题：${diaryEntry.chapterTitle || '未命名章节'}`,
    `日记日期：${diaryEntry.diaryDate ? diaryEntry.diaryDate.toISOString().slice(0, 10) : '未填写'}`,
    `日记内容：${diaryEntry.diaryText || '今天的生活片段'}`,
    `情绪标签：${selectedTags}`,
    `页数模式：${diaryEntry.pageMode || 'custom'}，用户期望页数：${diaryEntry.pageCount || 1}`,
    ...characterLines,
    '只生成单张图片，不要输出文字说明，不要包含真实隐私信息。',
  ].join('\n')
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

function summarizeText(value) {
  if (!value) return ''
  return String(value).slice(0, 80)
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
