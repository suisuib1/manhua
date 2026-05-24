const emotionTags = [
  { key: 'warm', label: '温暖' },
  { key: 'happy', label: '搞笑' },
  { key: 'healing', label: '治愈' },
  { key: 'brave', label: '勇敢' },
  { key: 'cute', label: '可爱' },
  { key: 'daily', label: '日常' },
  { key: 'calm', label: '平静' },
  { key: 'memory', label: '纪念' },
]

function listEmotionTags() {
  return {
    items: emotionTags.map((item) => Object.assign({}, item)),
  }
}

module.exports = {
  listEmotionTags,
}
