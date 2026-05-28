<template>
  <section class="detail-page">
    <div class="page-heading">
      <div>
        <el-button text type="primary" @click="goBack">返回列表</el-button>
        <h1>漫画章节详情</h1>
      </div>
      <el-button :loading="loading" @click="loadDetail">刷新</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      type="error"
      :closable="false"
      :title="errorMessage"
    />

    <el-skeleton v-if="loading && !detail" :rows="10" animated />

    <template v-else-if="detail">
      <el-card shadow="never">
        <template #header>日记信息</template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日记 ID">{{ detail.diary.id }}</el-descriptions-item>
          <el-descriptions-item label="用户 ID">{{ detail.diary.ownerUserId }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ detail.diary.title || '-' }}</el-descriptions-item>
          <el-descriptions-item label="情绪">{{ detail.diary.mood || '-' }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ formatTime(detail.diary.date) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detail.diary.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatTime(detail.diary.updatedAt) }}</el-descriptions-item>
          <el-descriptions-item label="正文" :span="2">
            <div class="diary-content">{{ detail.diary.content || '-' }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <div class="info-grid">
        <el-card shadow="never">
          <template #header>用户信息</template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户 ID">{{ detail.user?.id || '-' }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ detail.user?.nickname || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>最新任务</template>
          <el-empty v-if="!detail.latestTask" description="暂无生成任务" />
          <el-descriptions v-else :column="1" border>
            <el-descriptions-item label="任务 ID">
              <el-button text type="primary" @click="goTaskDetail(detail.latestTask.id)">
                {{ detail.latestTask.id }}
              </el-button>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusType(detail.latestTask.status)">
                {{ statusText(detail.latestTask.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.latestTask.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="开始时间">{{ formatTime(detail.latestTask.startedAt) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatTime(detail.latestTask.finishedAt) }}</el-descriptions-item>
            <el-descriptions-item label="图片">{{ detail.latestTask.hasImage ? '有图' : '无图' }}</el-descriptions-item>
            <el-descriptions-item label="错误信息">
              <span class="break-text">{{ detail.latestTask.errorMessage || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </div>

      <el-card shadow="never">
        <template #header>生成图片</template>
        <div v-if="previewImageUrl" class="image-preview">
          <el-image
            :src="previewImageUrl"
            fit="contain"
            :preview-src-list="[previewImageUrl]"
            preview-teleported
          />
          <div class="image-url">{{ detail.latestTask.imageUrl }}</div>
        </div>
        <el-empty v-else description="暂无图片" />
      </el-card>

      <el-card shadow="never">
        <template #header>任务历史</template>
        <el-table
          :data="detail.taskHistory || []"
          empty-text="暂无任务历史"
          style="width: 100%"
        >
          <el-table-column prop="id" label="任务 ID" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" effect="light">
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.finishedAt) }}</template>
          </el-table-column>
          <el-table-column label="图片" width="90">
            <template #default="{ row }">{{ row.hasImage ? '有图' : '无图' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" @click="goTaskDetail(row.id)">查看任务</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { getComicChapterDetail } from '../api/comicChapters'
import {
  formatTime,
  normalizeAssetUrl,
  statusText,
  statusType,
} from '../utils/taskFormat'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const detail = ref(null)

const previewImageUrl = computed(() => normalizeAssetUrl(detail.value?.latestTask?.imageUrl || ''))

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''

  try {
    detail.value = await getComicChapterDetail(route.params.diaryEntryId)
  } catch (err) {
    errorMessage.value = err.message || '漫画章节详情加载失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/comic-chapters')
}

function goTaskDetail(id) {
  router.push(`/generation-tasks/${id}`)
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

.diary-content {
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
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
