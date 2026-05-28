export function formatTime(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString()
}

export function formatDuration(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return '-'
  }

  if (numberValue < 1000) {
    return `${Math.round(numberValue)}ms`
  }

  return `${(numberValue / 1000).toFixed(1)}s`
}

export function statusText(status) {
  const map = {
    no_task: '未生成',
    pending: '等待中',
    processing: '生成中',
    completed: '已完成',
    failed: '失败',
  }

  return map[status] || status || '-'
}

export function statusType(status) {
  const map = {
    no_task: 'info',
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
  }

  return map[status] || 'info'
}

export function normalizeAssetUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/uploads/')) {
    return `http://127.0.0.1:3000${value}`
  }
  return value
}

export function formatJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch (err) {
    return '{}'
  }
}
