const { prisma } = require('../utils/prisma')

async function createGenerationTask(ownerUserId, input) {
  const diaryEntryId = assertRequiredString(input.diaryEntryId, 'diaryEntryId is required')
  const diaryEntry = await findOwnedDiaryEntry(ownerUserId, diaryEntryId)
  const now = new Date()
  const taskInput = buildTaskInput(diaryEntry)
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
