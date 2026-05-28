import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAdminMe, login as loginRequest } from '../api/adminAuth'

const tokenStorageKey = 'adminToken'
const adminStorageKey = 'adminInfo'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(tokenStorageKey) || '')
  const admin = ref(readStoredAdmin())

  const isLoggedIn = computed(() => Boolean(token.value))

  async function login(username, password) {
    const data = await loginRequest({ username, password })
    setSession(data.token, data.admin)
    return data.admin
  }

  async function fetchMe() {
    const data = await getAdminMe()
    admin.value = data
    localStorage.setItem(adminStorageKey, JSON.stringify(data))
    return data
  }

  function setSession(nextToken, nextAdmin) {
    token.value = nextToken || ''
    admin.value = nextAdmin || null
    localStorage.setItem(tokenStorageKey, token.value)
    localStorage.setItem(adminStorageKey, JSON.stringify(admin.value))
  }

  function logout() {
    token.value = ''
    admin.value = null
    localStorage.removeItem(tokenStorageKey)
    localStorage.removeItem(adminStorageKey)
  }

  return {
    admin,
    fetchMe,
    isLoggedIn,
    login,
    logout,
    token,
  }
})

function readStoredAdmin() {
  try {
    const value = localStorage.getItem(adminStorageKey)
    return value ? JSON.parse(value) : null
  } catch (err) {
    return null
  }
}
