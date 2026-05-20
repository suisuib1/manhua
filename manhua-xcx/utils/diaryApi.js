const { request } = require('./api')

function createDiaryEntry(data) {
  return request({
    url: '/api/diary-entries',
    method: 'POST',
    data,
    auth: true,
  })
}

function updateDiaryEntry(id, data) {
  return request({
    url: `/api/diary-entries/${id}`,
    method: 'PUT',
    data,
    auth: true,
  })
}

function getDiaryEntry(id) {
  return request({
    url: `/api/diary-entries/${id}`,
    method: 'GET',
    auth: true,
  })
}

function listDiaryEntries(params) {
  return request({
    url: '/api/diary-entries',
    method: 'GET',
    data: params,
    auth: true,
  })
}

function deleteDiaryEntry(id) {
  return request({
    url: `/api/diary-entries/${id}`,
    method: 'DELETE',
    auth: true,
  })
}

module.exports = {
  createDiaryEntry,
  updateDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  deleteDiaryEntry,
}
