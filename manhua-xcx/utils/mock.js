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

const homeMock = {
  user: {
    nickname: '小满',
    greetingTitle: '早安',
    greetingText: '今天也来记录可爱的生活吧~',
  },
  defaultComicBook: {
    title: '我的漫画书',
    privacyLabel: '私密记录',
    description: '这是属于你的专属漫画日记本',
    chapterCount: 3,
  },
  freeQuotaRemaining: 2,
  quotaHint: '今日剩余免费生成次数',
  recentChapters: [
    {
      id: 'chapter-003',
      title: '第3章',
      subtitle: '春日野餐记',
      date: '05-18',
      summary: '把阳光、点心和好心情收进格子里。',
      status: chapterStatuses.completed,
      statusText: '已完成',
      coverTone: 'sunny',
    },
    {
      id: 'chapter-002',
      title: '第2章',
      subtitle: '下雨天的宅家',
      date: '05-17',
      summary: '窗边、热茶和慢慢亮起来的小房间。',
      status: chapterStatuses.generating,
      statusText: '生成中',
      coverTone: 'home',
    },
    {
      id: 'chapter-001',
      title: '第1章',
      subtitle: '意外的小确幸',
      date: '05-16',
      summary: '路上的雨声，也可以变成可爱分镜。',
      status: chapterStatuses.failed,
      statusText: '生成失败',
      coverTone: 'rain',
    },
  ],
}

module.exports = {
  pageRoutes,
  chapterStatuses,
  homeMock,
}
