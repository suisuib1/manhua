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
            <span>最近生成任务</span>
          </div>
        </template>

        <el-table
          :data="recentTasks"
          empty-text="暂无生成任务"
          style="width: 100%"
        >
          <el-table-column prop="id" label="任务 ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="diaryTitle" label="章节标题" min-width="150" show-overflow-tooltip />
          <el-table-column label="用户" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.userNickname || row.ownerUserId || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="90">
            <template #default="{ row }">{{ row.hasImage ? '有图' : '无图' }}</template>
          </el-table-column>
          <el-table-column prop="errorMessage" label="错误摘要" min-width="180" show-overflow-tooltip />
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="section-header">
            <span>最近漫画章节</span>
          </div>
        </template>

        <el-table
          :data="recentChapters"
          empty-text="暂无漫画章节"
          style="width: 100%"
        >
          <el-table-column label="封面" width="90">
            <template #default="{ row }">
              <el-image
                v-if="row.coverImageUrl"
                class="cover-image"
                :src="normalizeAssetUrl(row.coverImageUrl)"
                fit="cover"
                :preview-src-list="[normalizeAssetUrl(row.coverImageUrl)]"
                preview-teleported
              />
              <div v-else class="cover-placeholder">无图</div>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="章节标题" min-width="170" show-overflow-tooltip />
          <el-table-column label="用户" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.userNickname || row.ownerUserId || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="mood" label="情绪" width="100" show-overflow-tooltip />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="90">
            <template #default="{ row }">{{ row.hasImage ? '有图' : '无图' }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getDashboardStats } from '../api/adminDashboard'
import { getComicChapters } from '../api/comicChapters'
import { getGenerationTasks } from '../api/generationTasks'
import {
  formatTime,
  normalizeAssetUrl,
  statusText,
  statusType,
} from '../utils/taskFormat'

const loading = ref(false)
const errorMessage = ref('')
const stats = ref(null)
const recentTasks = ref([])
const recentChapters = ref([])
const taskTotal = ref(0)
const chapterTotal = ref(0)
const todayTaskCount = ref(0)
const todayChapterCount = ref(0)

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
  { label: '漫画章节总数', value: chapterTotal.value || currentStats.value.diaryEntryCount },
  { label: '今日日记/章节', value: todayChapterCount.value },
  { label: '生成任务总数', value: taskTotal.value || currentStats.value.generationTaskCount },
  { label: '今日生成任务', value: todayTaskCount.value },
])

const statusCards = computed(() => {
  const counts = currentStats.value.generationTaskStatusCounts || emptyStats.generationTaskStatusCounts
  return [
    { key: 'pending', label: '等待中', value: counts.pending || 0 },
    { key: 'processing', label: '生成中', value: counts.processing || 0 },
    { key: 'completed', label: '已完成', value: counts.completed || 0 },
    { key: 'failed', label: '失败', value: counts.failed || 0 },
  ]
})

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''

  try {
    const today = formatDateParam(new Date())
    const [
      dashboard,
      taskList,
      chapterList,
      todayTaskList,
      todayChapterList,
    ] = await Promise.all([
      getDashboardStats(),
      getGenerationTasks({ page: 1, pageSize: 5 }),
      getComicChapters({ page: 1, pageSize: 5 }),
      getGenerationTasks({ page: 1, pageSize: 1, dateFrom: today, dateTo: today }),
      getComicChapters({ page: 1, pageSize: 1, dateFrom: today, dateTo: today }),
    ])

    stats.value = dashboard
    recentTasks.value = taskList.items || []
    recentChapters.value = chapterList.items || []
    taskTotal.value = taskList.pagination?.total || dashboard.generationTaskCount || 0
    chapterTotal.value = chapterList.pagination?.total || dashboard.diaryEntryCount || 0
    todayTaskCount.value = todayTaskList.pagination?.total || 0
    todayChapterCount.value = todayChapterList.pagination?.total || 0
  } catch (err) {
    errorMessage.value = err.message || '首页数据加载失败'
  } finally {
    loading.value = false
  }
}

function formatDateParam(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.cover-image,
.cover-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 8px;
}

.cover-image {
  border: 1px solid #e5e7eb;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  font-size: 13px;
}
</style>
