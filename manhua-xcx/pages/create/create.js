const { createChapterMock, pageRoutes } = require('../../utils/mock')
const { saveDraftWithBackendFallback } = require('../../utils/diarySync')
const { getEmotionTags } = require('../../utils/emotionTagApi')

function formatLocalDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function buildCreateDraft(data) {
  const selectedTags = Array.isArray(data.selectedTags) ? data.selectedTags : []
  const tagOptions = Array.isArray(data.tagOptions) ? data.tagOptions : []
  const pageCount = normalizePageCount(data.pageCountInput || data.pageCount)

  return {
    chapterTitle: String(data.draftChapterTitle || '').trim(),
    diaryDate: data.diaryDateValue,
    pageCount,
    pageMode: data.pageMode,
    selectedTags,
    selectedTagItems: selectedTags.map((key) => {
      const tagOption = tagOptions.find((item) => item.value === key) || {}
      return {
        key,
        label: tagOption.label || key,
      }
    }),
  }
}

function normalizeTagOption(tag) {
  return {
    value: tag.key || tag.value,
    label: tag.label || '',
    selected: false,
  }
}

function normalizePageCount(value) {
  const pageCount = Number(value)

  if (!Number.isFinite(pageCount)) {
    return 1
  }

  return Math.min(4, Math.max(1, Math.trunc(pageCount)))
}

function getRandomPageCount() {
  return Math.floor(Math.random() * 4) + 1
}

function buildFallbackTagOptions() {
  return createChapterMock.tagOptions.map((item) => normalizeTagOption(item))
}

function encodeDraft(draft) {
  return encodeURIComponent(JSON.stringify(draft))
}

function decodeDraft(query) {
  if (!query) return null

  try {
    return JSON.parse(decodeURIComponent(query))
  } catch (err) {
    return null
  }
}

Page({
  data: {
    title: createChapterMock.title,
    subtitle: createChapterMock.subtitle,
    draftChapterTitle: '',
    diaryDateValue: formatLocalDate(),
    diaryDateLabel: formatLocalDate(),
    dateHint: createChapterMock.dateHint,
    pageMode: createChapterMock.pageMode,
    pageCount: createChapterMock.pageCount,
    pageCountInput: String(createChapterMock.pageCount),
    freeQuotaRemaining: createChapterMock.freeQuotaRemaining,
    quotaHint: createChapterMock.quotaHint,
    tagOptions: buildFallbackTagOptions(),
    selectedTags: [],
    note: createChapterMock.note,
  },

  onLoad() {
    return this.loadEmotionTags()
  },

  async loadEmotionTags() {
    try {
      const data = await getEmotionTags()
      const items = data && Array.isArray(data.items) ? data.items : []
      const tagOptions = items.map(normalizeTagOption).filter((item) => item.value && item.label)

      this.setData({
        tagOptions: tagOptions.length > 0 ? tagOptions : buildFallbackTagOptions(),
        selectedTags: [],
      })
      return data
    } catch (error) {
      this.setData({
        tagOptions: buildFallbackTagOptions(),
        selectedTags: [],
      })
      return null
    }
  },

  onTitleInput(event) {
    this.setData({ draftChapterTitle: event.detail.value })
  },

  clearTitle() {
    this.setData({ draftChapterTitle: '' })
  },

  onDateChange(event) {
    const diaryDateValue = event.detail.value
    this.setData({
      diaryDateValue,
      diaryDateLabel: diaryDateValue,
    })
  },

  selectRandomPageMode() {
    const pageCount = getRandomPageCount()

    this.setData({
      pageMode: 'random',
      pageCount,
      pageCountInput: String(pageCount),
    })
  },

  onPageCountInput(event) {
    const pageCountInput = String(event.detail.value || '').trim()
    const pageCount = pageCountInput ? normalizePageCount(pageCountInput) : this.data.pageCount

    this.setData({
      pageMode: 'custom',
      pageCount,
      pageCountInput,
    })
  },

  onPageCountBlur() {
    const pageCount = normalizePageCount(this.data.pageCountInput || this.data.pageCount)

    this.setData({
      pageMode: 'custom',
      pageCount,
      pageCountInput: String(pageCount),
    })
  },

  toggleTag(event) {
    const { value } = event.currentTarget.dataset
    const selectedTags = this.data.selectedTags.slice()
    const currentIndex = selectedTags.indexOf(value)

    if (currentIndex === -1) selectedTags.push(value)
    else selectedTags.splice(currentIndex, 1)

    this.setData({
      selectedTags,
      tagOptions: this.data.tagOptions.map((item) => Object.assign({}, item, {
        selected: selectedTags.indexOf(item.value) !== -1,
      })),
    })
  },

  goNext() {
    const pageCount = normalizePageCount(this.data.pageCountInput || this.data.pageCount)
    const nextData = Object.assign({}, this.data, {
      pageCount,
      pageCountInput: String(pageCount),
    })

    this.setData({
      pageCount,
      pageCountInput: String(pageCount),
    })

    const draft = buildCreateDraft(nextData)
    if (!draft.chapterTitle) {
      wx.showToast({
        title: '请先填写章节标题',
        icon: 'none',
      })
      return
    }

    saveDraftWithBackendFallback(draft)
    wx.navigateTo({
      url: `${pageRoutes.diary}?draft=${encodeDraft(draft)}`,
    })
  },
})

module.exports = {
  buildCreateDraft,
  encodeDraft,
  decodeDraft,
  formatLocalDate,
  normalizeTagOption,
  buildFallbackTagOptions,
  normalizePageCount,
  getRandomPageCount,
}
