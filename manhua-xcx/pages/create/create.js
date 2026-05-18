const { createChapterMock, pageRoutes } = require('../../utils/mock')

function markSelected(options, selectedValues) {
  return options.map((option) => Object.assign({}, option, {
    selected: selectedValues.indexOf(option.value) !== -1,
  }))
}

function markPageModes(options, selectedMode) {
  return options.map((option) => Object.assign({}, option, {
    selected: option.value === selectedMode,
  }))
}

function buildPageCountOptions(counts, selectedCount, pageMode) {
  return counts.map((count) => ({
    count,
    label: `${count}页`,
    selected: pageMode === 'custom' && selectedCount === count,
  }))
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
    freeQuotaRemaining: createChapterMock.freeQuotaRemaining,
    quotaHint: createChapterMock.quotaHint,
    pageModeOptions: markPageModes(createChapterMock.pageModeOptions, createChapterMock.pageMode),
    pageCountOptions: buildPageCountOptions(
      createChapterMock.pageCountOptions,
      createChapterMock.pageCount,
      createChapterMock.pageMode
    ),
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

  selectPageMode(event) {
    const { mode } = event.currentTarget.dataset

    this.setData({
      pageMode: mode,
      pageModeOptions: markPageModes(createChapterMock.pageModeOptions, mode),
      pageCountOptions: buildPageCountOptions(createChapterMock.pageCountOptions, this.data.pageCount, mode),
    })
  },

  selectPageCount(event) {
    const pageCount = Number(event.currentTarget.dataset.count)

    this.setData({
      pageMode: 'custom',
      pageCount,
      pageModeOptions: markPageModes(createChapterMock.pageModeOptions, 'custom'),
      pageCountOptions: buildPageCountOptions(createChapterMock.pageCountOptions, pageCount, 'custom'),
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
