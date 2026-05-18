const { createChapterMock, pageRoutes } = require('../../utils/mock')

function markSelected(options, selectedValues) {
  return options.map((option) => Object.assign({}, option, {
    selected: selectedValues.indexOf(option.value) !== -1,
  }))
}

function normalizePageCount(value) {
  const digit = String(value || '').replace(/[^1-8]/g, '').slice(0, 1)

  return digit
}

Page({
  data: {
    title: createChapterMock.title,
    subtitle: createChapterMock.subtitle,
    draftChapterTitle: createChapterMock.draftChapterTitle,
    diaryDateLabel: createChapterMock.diaryDateLabel,
    dateHint: createChapterMock.dateHint,
    pageMode: createChapterMock.pageMode,
    pageCount: createChapterMock.pageCount,
    pageCountInput: String(createChapterMock.pageCount),
    freeQuotaRemaining: createChapterMock.freeQuotaRemaining,
    quotaHint: createChapterMock.quotaHint,
    tagOptions: markSelected(createChapterMock.tagOptions, createChapterMock.selectedTags),
    selectedTags: createChapterMock.selectedTags,
    note: createChapterMock.note,
  },

  onTitleInput(event) {
    this.setData({
      draftChapterTitle: event.detail.value,
    })
  },

  clearTitle() {
    this.setData({
      draftChapterTitle: '',
    })
  },

  selectRandomPageMode() {
    this.setData({
      pageMode: 'random',
    })
  },

  onPageCountInput(event) {
    const pageCountInput = normalizePageCount(event.detail.value)
    const pageCount = Number(pageCountInput || this.data.pageCount || 1)

    this.setData({
      pageMode: 'custom',
      pageCount,
      pageCountInput,
    })
  },

  onPageCountBlur() {
    const pageCountInput = normalizePageCount(this.data.pageCountInput) || '1'

    this.setData({
      pageMode: 'custom',
      pageCount: Number(pageCountInput),
      pageCountInput,
    })
  },

  toggleTag(event) {
    const { value } = event.currentTarget.dataset
    const selectedTags = this.data.selectedTags.slice()
    const currentIndex = selectedTags.indexOf(value)

    if (currentIndex === -1) {
      selectedTags.push(value)
    } else {
      selectedTags.splice(currentIndex, 1)
    }

    this.setData({
      selectedTags,
      tagOptions: markSelected(createChapterMock.tagOptions, selectedTags),
    })
  },

  goNext() {
    wx.navigateTo({
      url: pageRoutes.diary,
    })
  },
})
