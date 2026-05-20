const pageRoutes = {
  home: '/pages/index/index',
  create: '/pages/create/create',
  diary: '/pages/diary/diary',
  character: '/pages/character/character',
  generating: '/pages/generating/generating',
  chapterDetail: '/pages/chapter-detail/chapter-detail',
  comicBook: '/pages/comic-book/comic-book',
  continuousChapter: '/pages/continuous-chapter/continuous-chapter',
  share: '/pages/share/share',
  mine: '/pages/mine/mine',
  quotaEmpty: '/pages/quota-empty/quota-empty',
  privacy: '/pages/privacy/privacy',
  about: '/pages/about/about',
  settings: '/pages/settings/settings',
}

const storageKeys = {
  generatedComicChapters: 'generatedComicChapters',
  draftComicChapter: 'draftComicChapter',
  comicAppSettings: 'comicAppSettings',
  authToken: 'authToken',
  currentUser: 'currentUser',
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
      pages: [
        {
          pageId: 'chapter-003-page-1',
          images: ['/subpackage/icon-home-mascot-star.png', '/subpackage/icon-home-heart.png', '/subpackage/icon-home-smile.png', '/subpackage/icon-home-star-badge.png'],
          caption: '草地上铺开小毯子，阳光像软软的糖落在点心旁边。',
        },
        {
          pageId: 'chapter-003-page-2',
          images: ['/subpackage/icon-home-mascot-star.png', '/subpackage/icon-home-pencil.png'],
          caption: '把今天的风、花和笑声画进最后一格，变成春天的书签。',
        },
      ],
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
      pages: [
        {
          pageId: 'chapter-002-page-1',
          images: ['/subpackage/icon-home-settings-book.png', '/subpackage/icon-home-smile.png', '/subpackage/icon-home-heart.png'],
          caption: '雨点轻轻敲窗，热茶冒着小小的云，房间慢慢亮起来。',
        },
        {
          pageId: 'chapter-002-page-2',
          images: ['/subpackage/icon-home-mascot-star.png'],
          caption: '窝在柔软的毯子里，连发呆也像一格安静的漫画。',
        },
      ],
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
      pages: [
        {
          pageId: 'chapter-001-page-1',
          images: ['/subpackage/icon-home-mascot-star.png', '/subpackage/icon-home-create-plus.png'],
          caption: '本来只是普通的一天，却在转角遇见一点点闪光。',
        },
        {
          pageId: 'chapter-001-page-2',
          images: ['/subpackage/icon-home-heart.png', '/subpackage/icon-home-pencil.png', '/subpackage/icon-home-smile.png', '/subpackage/icon-home-star-badge.png'],
          caption: '把雨声和小确幸一起收好，今天也值得被认真画下来。',
        },
      ],
    },
  ],
}

const createChapterMock = {
  title: '创建日记章节',
  subtitle: '先给今天的故事取个名字吧',
  draftChapterTitle: '和小猫一起的傍晚',
  diaryDate: '2026-05-18',
  diaryDateLabel: '2026-05-18（今天）',
  dateHint: '同一天也可以记录多章',
  pageMode: 'custom',
  pageCount: 1,
  freeQuotaRemaining: 2,
  quotaHint: '当前剩余免费生成次数',
  pageModeOptions: [
    {
      value: 'random',
      label: '随机生成',
      iconText: '骰',
    },
    {
      value: 'custom',
      label: '自定义',
      iconText: '页',
    },
  ],
  pageCountOptions: [1, 2, 3, 4, 5, 6, 7, 8],
  tagOptions: [
    { value: 'warm', label: '温馨' },
    { value: 'funny', label: '搞笑' },
    { value: 'healing', label: '治愈' },
    { value: 'fairy', label: '童话' },
    { value: 'cute', label: '可爱' },
    { value: 'daily', label: '日常' },
    { value: 'happy', label: '开心' },
    { value: 'sad', label: '难过' },
    { value: 'memory', label: '纪念' },
  ],
  selectedTags: ['warm', 'healing', 'cute'],
  note: '这些标签会帮助我们更好地把握章节的氛围，不会限制你的创作哦~',
}

const diaryMock = {
  title: '填写今天的日记和照片',
  subtitle: '只记录想变成漫画的片段就好，慢慢写也可以',
  chapterSummary: {
    title: '和小猫一起的傍晚',
    dateLabel: '2026-05-18 今天',
    pageModeText: '自定义 1 张',
    tags: ['温馨', '治愈', '可爱'],
  },
  diaryPlaceholder: '写下今天最想留住的一幕，比如天气、心情、遇到的人，或一张照片背后的小故事。',
  diaryTextMaxLength: 800,
  photoLimit: 1,
  photoPlaceholders: [],
  characterHint: '会参考你的角色档案生成主角，帮助保持 Q 版形象一致。',
  privacyHint: '日记原文不会公开，分享页只展示你允许分享的标题、摘要和漫画图。',
}

const characterMock = {
  title: '我的漫画主角',
  subtitle: '让每一章里的你都保持熟悉又可爱',
  avatarText: 'Q',
  nickname: '小满',
  relation: '默认漫画书主角',
  description: '喜欢暖色外套，戴着小发夹，表情软软的 Q 版女孩。',
  personalityTags: [
    { value: 'gentle', label: '温柔', selected: true },
    { value: 'curious', label: '好奇', selected: true },
    { value: 'brave', label: '勇敢', selected: false },
    { value: 'quiet', label: '安静', selected: false },
    { value: 'sunny', label: '元气', selected: true },
  ],
  appearanceTags: [
    { value: 'short-hair', label: '短发', selected: true },
    { value: 'pink-pin', label: '粉色发夹', selected: true },
    { value: 'warm-coat', label: '暖色外套', selected: true },
    { value: 'round-eyes', label: '圆圆眼睛', selected: false },
  ],
  notes: [
    '修改角色档案只会影响之后生成的漫画。',
    '不会影响之前已经生成的漫画。',
  ],
}

const generatingMock = {
  title: '漫画正在生成中',
  subtitle: '把今天的小事慢慢装进分镜里',
  taskId: 'mock-task-20260518',
  chapterTitle: '和小猫一起的傍晚',
  statusText: '本地模拟生成中',
  estimatedText: '预计还需要 1-2 分钟',
  progressStart: 18,
  steps: [
    { id: 'step-1', label: '分析日记', detail: '提取今天的故事重点' },
    { id: 'step-2', label: '理解照片', detail: '记录照片里的场景线索' },
    { id: 'step-3', label: '保持角色一致', detail: '参考主角档案' },
    { id: 'step-4', label: '生成分镜', detail: '排成 Q 版漫画画面' },
    { id: 'step-5', label: '保存章节', detail: '放进你的私人漫画书' },
  ],
}

const chapterDetailMock = {
  id: 'chapter-003',
  title: '和小猫一起的傍晚',
  date: '2026-05-18',
  privacyLabel: '私密章节',
  tags: ['温馨', '治愈', '可爱'],
  summary: '傍晚散步时遇到一只小猫，夕阳、点心和轻轻的风一起变成了今天的漫画记忆。',
  comicPages: [
    { id: 'page-1', title: '第 1 张', tone: 'sunny', panels: ['遇见', '靠近', '陪伴', '回家'] },
    { id: 'page-2', title: '第 2 张', tone: 'home', panels: ['点心', '晚霞', '合影', '收藏'] },
  ],
  privacyNote: '这里只展示摘要和漫画结果占位，不展示完整原始日记。',
}

const shareMock = {
  title: '和小猫一起的傍晚',
  date: '2026-05-18',
  visibility: '仅私密链接可见',
  linkStatus: '私密链接已生成',
  shareUrl: 'mock://private-chapter/chapter-003',
  summary: '一段适合分享的温柔摘要，不包含完整日记原文。',
  comicPreview: [
    { id: 'share-page-1', title: '漫画预览 1', tone: 'sunny' },
    { id: 'share-page-2', title: '漫画预览 2', tone: 'home' },
  ],
  notes: [
    '访问者只能通过链接查看这一章。',
    '不会公开整本漫画书，也不会展示未授权内容。',
    '当前为静态占位，不会调用真实分享接口。',
  ],
}

const mineMock = {
  user: {
    nickname: '小满',
    subtitle: '私人漫画书记录中',
  },
  bookStats: {
    title: '我的漫画书',
    chapterCount: 3,
    completedCount: 1,
    generatingCount: 1,
  },
  chapters: homeMock.recentChapters,
  freeQuotaRemaining: 2,
  freeQuotaTotal: 3,
  menuItems: [
    { id: 'character', title: '角色档案', desc: '维护漫画主角形象', action: 'character' },
    { id: 'privacy', title: '隐私说明', desc: '了解日记和分享边界', action: 'privacy' },
    { id: 'about', title: '关于产品', desc: '私人日记漫画本', action: 'about' },
    { id: 'settings', title: '设置', desc: '基础设置占位', action: 'settings' },
  ],
}

const comicBookMock = {
  book: homeMock.defaultComicBook,
  user: mineMock.user,
  comics: [
    {
      id: 'book-001',
      title: '我的漫画书',
      subtitle: '私人漫画书记录中',
      progressText: '继续阅读到第2章',
      chapterCount: 3,
      lastReadChapterId: 'chapter-002',
      coverTone: 'sunny',
    },
  ],
  chapters: homeMock.recentChapters,
  readingHint: '像翻开一本自己的漫画书，一页一页继续读。',
}

const continuousChapterMock = {
  comic: {
    id: 'book-001',
    title: '我的漫画书',
    subtitle: '私人漫画书记录中',
  },
  currentChapterId: 'chapter-002',
  chapters: homeMock.recentChapters,
}

const quotaEmptyMock = {
  title: '今日免费次数已用完',
  subtitle: '今天的漫画能量先休息一下，明天再继续记录吧。',
  resetHint: '免费次数会在明天恢复，今天可以先整理下一章想画的日记片段。',
  actions: {
    home: '返回首页',
    chapter: '查看已有漫画',
  },
  tips: ['可以先整理明天想画的日记片段', '也可以回看已经生成的章节'],
}

module.exports = {
  pageRoutes,
  chapterStatuses,
  homeMock,
  createChapterMock,
  diaryMock,
  characterMock,
  generatingMock,
  chapterDetailMock,
  comicBookMock,
  continuousChapterMock,
  shareMock,
  mineMock,
  quotaEmptyMock,
  storageKeys,
}
