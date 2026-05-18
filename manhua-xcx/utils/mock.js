const pageRoutes = {
  home: '/pages/index/index',
  create: '/pages/create/index',
  diary: '/pages/diary/index',
  character: '/pages/character/index',
  generating: '/pages/generating/index',
  chapterDetail: '/pages/chapter-detail/index',
  share: '/pages/share/index',
  mine: '/pages/mine/index',
  quotaEmpty: '/pages/quota-empty/index',
}

const chapterStatuses = {
  completed: 'completed',
  generating: 'generating',
  failed: 'failed',
  quotaEmpty: 'quotaEmpty',
}

module.exports = {
  pageRoutes,
  chapterStatuses,
}
