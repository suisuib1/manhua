const test = require('node:test')
const assert = require('node:assert/strict')

const { clearCoreTables, prisma } = require('./helpers/testDatabase')

const prefix = 'test_issue12_'

function uniqueOpenid() {
  return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`
}

test('Prisma can create and query generation tasks for diary entries', async () => {
  await clearCoreTables()

  let userId
  let diaryEntryId

  try {
    const user = await prisma.user.create({
      data: {
        wxOpenid: uniqueOpenid(),
        wxUnionid: `${prefix}union`,
      },
    })
    userId = user.id

    const diaryEntry = await prisma.diaryEntry.create({
      data: {
        ownerUserId: userId,
        chapterTitle: `${prefix}chapter`,
        diaryText: `${prefix}diary text`,
        pageCount: 4,
        pageMode: 'custom',
        status: 'draft',
      },
    })
    diaryEntryId = diaryEntry.id

    const input = {
      diaryEntryId,
      pageCount: 4,
      style: 'q_version',
    }

    const generationTask = await prisma.generationTask.create({
      data: {
        ownerUserId: userId,
        diaryEntryId,
        status: 'pending',
        promptSnapshot: `${prefix}prompt`,
        inputJson: JSON.stringify(input),
      },
    })

    assert.equal(generationTask.ownerUserId, userId)
    assert.equal(generationTask.diaryEntryId, diaryEntryId)
    assert.equal(generationTask.status, 'pending')
    assert.equal(generationTask.taskType, 'diary_to_comic')
    assert.deepEqual(JSON.parse(generationTask.inputJson), input)

    const tasks = await prisma.generationTask.findMany({
      where: {
        ownerUserId: userId,
        status: 'pending',
      },
      include: {
        owner: true,
        diaryEntry: true,
      },
    })

    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].id, generationTask.id)
    assert.equal(tasks[0].owner.id, userId)
    assert.equal(tasks[0].diaryEntry.id, diaryEntryId)
  } finally {
    if (userId) {
      await prisma.generationTask.deleteMany({ where: { ownerUserId: userId } })
    }
    if (diaryEntryId) {
      await prisma.diaryPhoto.deleteMany({ where: { diaryEntryId } })
      await prisma.diaryEntry.deleteMany({ where: { id: diaryEntryId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  }
})
