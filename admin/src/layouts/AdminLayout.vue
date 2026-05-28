<template>
  <el-container class="admin-shell">
    <el-aside width="220px" class="admin-sidebar">
      <div class="brand">日记漫画后台</div>
      <el-menu
        router
        :default-active="$route.path"
        class="admin-menu"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <span>首页概览</span>
        </el-menu-item>
        <el-menu-item index="/generation-tasks">
          <el-icon><List /></el-icon>
          <span>生成任务</span>
        </el-menu-item>
        <el-menu-item index="/comic-chapters">
          <el-icon><Notebook /></el-icon>
          <span>漫画章节</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="page-title">后台管理系统</div>
        <div class="admin-actions">
          <span class="admin-name">{{ auth.admin?.displayName || auth.admin?.username || '管理员' }}</span>
          <el-button text type="primary" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>

      <el-main class="admin-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { DataBoard, List, Notebook } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.replace('/login')
}
</script>

<style scoped>
.admin-shell {
  min-height: 100vh;
}

.admin-sidebar {
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
}

.brand {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  border-bottom: 1px solid #e5e7eb;
}

.admin-menu {
  border-right: 0;
}

.admin-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
}

.admin-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.admin-name {
  color: #4b5563;
}

.admin-main {
  background: #f5f7fb;
  padding: 24px;
}
</style>
