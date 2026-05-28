<template>
  <section class="detail-page">
    <div class="page-heading">
      <div>
        <el-button text type="primary" @click="goBack">返回列表</el-button>
        <h1>生成任务详情</h1>
      </div>
      <el-button :loading="loading" @click="loadDetail">刷新</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      type="error"
      :closable="false"
      :title="errorMessage"
    />

    <el-skeleton v-if="loading && !task" :rows="10" animated />

    <template v-else-if="task">
      <el-card shadow="never">
        <template #header>基础信息</template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务 ID">{{ task.id }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType(task.status)">{{ statusText(task.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="日记 ID">{{ task.diaryEntryId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户 ID">{{ task.ownerUserId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(task.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatTime(task.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ formatTime(task.finishedAt) }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ formatDuration(task.durationMs) }}</el-descriptions-item>
          <el-descriptions-item label="错误信息" :span="2">
            <span class="break-text">{{ task.errorMessage || '-' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <div class="info-grid">
        <el-card shadow="never">
          <template #header>用户信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户 ID">{{ task.user?.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ task.user?.nickname || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>日记信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="日记 ID">{{ task.diary?.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="标题">{{ task.diary?.title || '-' }}</el-descriptions-item>
            <el-descriptions-item label="情绪">{{ task.diary?.mood || '-' }}</el-descriptions-item>
            <el-descriptions-item label="日期">{{ formatTime(task.diary?.date) }}</el-descriptions-item>
            <el-descriptions-item label="内容摘要">
              <span class="break-text">{{ task.diary?.content || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </div>

      <el-card shadow="never">
        <template #header>生成结果</template>
        <div v-if="imageUrl" class="image-preview">
          <el-image
            :src="imageUrl"
            fit="contain"
            :preview-src-list="[imageUrl]"
            preview-teleported
          />
          <div class="image-url">{{ rawImageUrl }}</div>
        </div>
        <el-empty v-else description="暂无图片" />
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { getGenerationTaskDetail } from '../api/generationTasks'
import {
  formatDuration,
  formatTime,
  normalizeAssetUrl,
  statusText,
  statusType,
} from '../utils/taskFormat'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const task = ref(null)

const rawImageUrl = computed(() => task.value?.imageUrl || '')
const imageUrl = computed(() => normalizeAssetUrl(rawImageUrl.value))

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''

  try {
    task.value = await getGenerationTaskDetail(route.params.id)
  } catch (err) {
    errorMessage.value = err.message || '任务详情加载失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/generation-tasks')
}

onMounted(loadDetail)
</script>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-heading h1 {
  margin: 8px 0 0;
  font-size: 24px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.break-text {
  word-break: break-all;
}

.image-preview {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.image-preview :deep(.el-image) {
  width: 280px;
  height: 280px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.image-url {
  max-width: 520px;
  color: #6b7280;
  word-break: break-all;
}

</style>
