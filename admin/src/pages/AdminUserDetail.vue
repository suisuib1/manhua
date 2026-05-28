<template>
  <section class="detail-page">
    <div class="page-heading">
      <div>
        <el-button text type="primary" @click="goBack">返回列表</el-button>
        <h1>用户详情</h1>
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
      <div class="info-grid">
        <el-card shadow="never">
          <template #header>基础信息</template>
          <div class="profile-head">
            <el-avatar :size="64" :src="normalizeAssetUrl(detail.user.avatarUrl)">
              {{ avatarText(detail.user.nickname) }}
            </el-avatar>
            <div>
              <div class="profile-name">{{ detail.user.nickname || '-' }}</div>
              <div class="muted">{{ detail.user.id }}</div>
            </div>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="用户 ID">{{ detail.user.id }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ detail.user.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="简介">
              <span class="break-text">{{ detail.user.bio || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.user.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.user.updatedAt) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never">
          <template #header>摘要统计</template>
          <div class="stat-grid">
            <div class="stat-item">
              <div class="stat-value">{{ detail.stats.diaryEntryCount || 0 }}</div>
              <div class="stat-label">日记</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ detail.stats.completedChapterCount || 0 }}</div>
              <div class="stat-label">完成章节</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ detail.stats.generationTaskCount || 0 }}</div>
              <div class="stat-label">生成任务</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ detail.stats.generatingTaskCount || 0 }}</div>
              <div class="stat-label">生成中</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ detail.stats.failedTaskCount || 0 }}</div>
              <div class="stat-label">失败任务</div>
            </div>
          </div>
        </el-card>
      </div>

      <el-card shadow="never">
        <template #header>角色档案</template>
        <el-empty v-if="!detail.characterProfile" description="暂无角色档案" />
        <div v-else class="character-layout">
          <el-image
            v-if="detail.characterProfile.referenceImageUrl"
            class="reference-image"
            :src="normalizeAssetUrl(detail.characterProfile.referenceImageUrl)"
            fit="cover"
            :preview-src-list="[normalizeAssetUrl(detail.characterProfile.referenceImageUrl)]"
            preview-teleported
          />
          <el-descriptions :column="2" border class="character-desc">
            <el-descriptions-item label="昵称">{{ detail.characterProfile.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item label="身份关系">{{ detail.characterProfile.roleTitle || '-' }}</el-descriptions-item>
            <el-descriptions-item label="角色描述" :span="2">
              <span class="break-text">{{ detail.characterProfile.description || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="性格关键词" :span="2">
              <span class="break-text">{{ detail.characterProfile.personalityText || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="外观特征" :span="2">
              <span class="break-text">{{ detail.characterProfile.appearanceText || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.characterProfile.updatedAt) }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>最近章节</template>
        <el-table
          :data="detail.recentChapters || []"
          empty-text="暂无最近章节"
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
          <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
          <el-table-column prop="diaryEntryId" label="日记 ID" min-width="180" show-overflow-tooltip />
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
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button text type="primary" @click="goChapterDetail(row.diaryEntryId)">查看章节</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>最近生成任务</template>
        <el-table
          :data="detail.recentGenerationTasks || []"
          empty-text="暂无最近生成任务"
          style="width: 100%"
        >
          <el-table-column prop="id" label="任务 ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="diaryEntryId" label="日记 ID" min-width="180" show-overflow-tooltip />
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
          <el-table-column label="完成时间" min-width="170">
            <template #default="{ row }">{{ formatTime(row.finishedAt) }}</template>
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
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { getAdminUserDetail } from '../api/adminUsers'
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

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''

  try {
    detail.value = await getAdminUserDetail(route.params.id)
  } catch (err) {
    errorMessage.value = err.message || '用户详情加载失败'
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/users')
}

function goChapterDetail(id) {
  router.push(`/comic-chapters/${id}`)
}

function goTaskDetail(id) {
  router.push(`/generation-tasks/${id}`)
}

function avatarText(nickname) {
  return (nickname || '用户').slice(0, 1)
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

.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.profile-name {
  color: #1f2937;
  font-size: 18px;
  font-weight: 700;
}

.muted {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
  word-break: break-all;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.stat-value {
  color: #1f2937;
  font-size: 26px;
  font-weight: 700;
}

.stat-label {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.character-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.reference-image {
  width: 160px;
  height: 160px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  flex: 0 0 auto;
}

.character-desc {
  flex: 1;
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

.break-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
