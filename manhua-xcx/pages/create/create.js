const { createChapterMock, pageRoutes } = require('../../utils/mock')
const { saveDraftWithBackendFallback } = require('../../utils/diarySync')

function formatLocalDate(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function buildCreateDraft(data) {
  return {
    chapterTitle: String(data.draftChapterTitle || '').trim(),
    diaryDate: data.diaryDateValue,
    pageCount: data.pageCount,
    pageMode: data.pageMode,
    selectedTags: data.selectedTags,
  }
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
    tagOptions: createChapterMock.tagOptions.map((item) => Object.assign({}, item, {
      selected: false,
    })),
    selectedTags: [],
    note: createChapterMock.note,
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
    this.setData({ pageMode: 'random' })
  },

  onPageCountInput(event) {
    const pageCount = Number(String(event.detail.value || '').replace(/[^1-8]/g, '').slice(0, 1) || 1)
    this.setData({
      pageMode: 'custom',
      pageCount,
      pageCountInput: String(pageCount),
    })
  },

  onPageCountBlur() {
    const pageCount = Number(String(this.data.pageCountInput || '1').replace(/[^1-8]/g, '').slice(0, 1) || 1)
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
      tagOptions: createChapterMock.tagOptions.map((item) => Object.assign({}, item, {
        selected: selectedTags.indexOf(item.value) !== -1,
      })),
    })
  },

  goNext() {
    const draft = buildCreateDraft(this.data)
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
}
