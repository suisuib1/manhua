<template>
  <section class="dashboard-page">
    <div class="page-heading">
      <h1>首页概览</h1>
      <el-button :loading="loading" @click="loadDashboard">刷新</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      class="dashboard-alert"
      type="error"
      :closable="false"
      :title="errorMessage"
    />

    <el-skeleton v-if="loading && !stats" :rows="8" animated />

    <template v-else>
      <div class="stat-grid">
        <el-card
          v-for="item in statCards"
          :key="item.label"
          shadow="never"
          class="stat-card"
        >
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value">{{ item.value }}</div>
        </el-card>
      </div>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span>生成任务状态</span>
          </div>
        </template>
        <div class="status-grid">
          <div
            v-for="item in statusCards"
            :key="item.key"
            class="status-item"
          >
            <span class="status-name">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span>最近失败任务</span>
          </div>
        </template>

        <el-table
          :data="recentFailedTasks"
          empty-text="暂无失败任务"
          style="width: 100%"
        >
          <el-table-column prop="taskId" label="Task ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="diaryEntryId" label="Diary Entry ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="errorMessage" label="错误摘要" min-width="240" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="创建时间" min-width="180" />
          <el-table-column prop="finishedAt" label="结束时间" min-width="180" />
        </el-table>
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getDashboardStats } from '../api/adminDashboard'

const loading = ref(false)
const errorMessage = ref('')
const stats = ref(null)

const emptyStats = {
  userCount: 0,
  todayNewUserCount: 0,
  diaryEntryCount: 0,
  generationTaskCount: 0,
  generationTaskStatusCounts: {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  },
  recentFailedTasks: [],
}

const currentStats = computed(() => stats.value || emptyStats)

const statCards = computed(() => [
  { label: '用户总数', value: currentStats.value.userCount },
  { label: '今日新增用户', value: currentStats.value.todayNewUserCount },
  { label: '日记数量', value: currentStats.value.diaryEntryCount },
  { label: '生成任务总数', value: currentStats.value.generationTaskCount },
])

const statusCards = computed(() => {
  const counts = currentStats.value.generationTaskStatusCounts || emptyStats.generationTaskStatusCounts
  return [
    { key: 'pending', label: 'Pending', value: counts.pending || 0 },
    { key: 'processing', label: 'Processing', value: counts.processing || 0 },
    { key: 'completed', label: 'Completed', value: counts.completed || 0 },
    { key: 'failed', label: 'Failed', value: counts.failed || 0 },
  ]
})

const recentFailedTasks = computed(() => currentStats.value.recentFailedTasks || [])

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    stats.value = await getDashboardStats()
  } catch (err) {
    errorMessage.value = err.message || '首页数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-heading h1 {
  margin: 0;
  font-size: 24px;
}

.dashboard-alert {
  max-width: 720px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card,
.section-card {
  border-radius: 8px;
}

.stat-label {
  color: #6b7280;
  font-size: 14px;
}

.stat-value {
  margin-top: 12px;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.section-header {
  font-weight: 600;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.status-name {
  color: #6b7280;
}
</style>
