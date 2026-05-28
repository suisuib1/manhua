import request from '../utils/request'

export function getComicChapters(params) {
  return request.get('/admin/comic-chapters', { params })
}

export function getComicChapterDetail(diaryEntryId) {
  return request.get(`/admin/comic-chapters/${diaryEntryId}`)
}
