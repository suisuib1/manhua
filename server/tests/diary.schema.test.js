const test = require('node:test')
const assert = require('node:assert/strict')

const { clearCoreTables, prisma } = require('./helpers/testDatabase')

const prefix = 'test_issue6_'

function uniqueOpenid() {
  return `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`
}

test('Prisma can create and query diary entries with photos', async () => {
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

    const selectedTagsJson = JSON.stringify(['warm', 'daily'])
    const diaryEntry = await prisma.diaryEntry.create({
      data: {
        ownerUserId: userId,
        chapterTitle: `${prefix}chapter`,
        diaryDate: new Date('2026-05-20T00:00:00.000Z'),
        diaryText: `${prefix}diary text`,
        pageCount: 4,
        pageMode: 'custom',
        selectedTagsJson,
        status: 'draft',
      },
    })
    diaryEntryId = diaryEntry.id

    await prisma.diaryPhoto.create({
      data: {
        diaryEntryId,
        ownerUserId: userId,
        imageUrl: `${prefix}local-photo.jpg`,
        originalName: `${prefix}photo.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
        sortOrder: 1,
      },
    })

    const entries = await prisma.diaryEntry.findMany({
      where: {
        ownerUserId: userId,
        status: 'draft',
      },
      include: {
        photos: true,
      },
    })

    assert.equal(entries.length, 1)
    assert.equal(entries[0].chapterTitle, `${prefix}chapter`)
    assert.equal(entries[0].selectedTagsJson, selectedTagsJson)
    assert.deepEqual(JSON.parse(entries[0].selectedTagsJson), ['warm', 'daily'])
    assert.equal(entries[0].photos.length, 1)
    assert.equal(entries[0].photos[0].ownerUserId, userId)

    const photos = await prisma.diaryPhoto.findMany({
      where: { diaryEntryId },
      orderBy: { sortOrder: 'asc' },
    })

    assert.equal(photos.length, 1)
    assert.equal(photos[0].imageUrl, `${prefix}local-photo.jpg`)
    assert.equal(photos[0].sortOrder, 1)
  } finally {
    if (diaryEntryId) {
      await prisma.diaryPhoto.deleteMany({ where: { diaryEntryId } })
      await prisma.diaryEntry.deleteMany({ where: { id: diaryEntryId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  }
})
