<template>
  <section class="user-page">
    <div class="page-heading">
      <h1>用户管理</h1>
      <el-button :loading="loading" @click="loadUsers">刷新</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="关键词">
          <el-input
            v-model.trim="filters.keyword"
            clearable
            placeholder="用户 ID / 昵称"
            class="keyword-input"
            @keyup.enter="handleSearch"
          />
        </el-form-item>

        <el-form-item label="开始日期">
          <el-date-picker
            v-model="filters.dateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="dateFrom"
          />
        </el-form-item>

        <el-form-item label="结束日期">
          <el-date-picker
            v-model="filters.dateTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="dateTo"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="items"
        empty-text="暂无用户"
        style="width: 100%"
      >
        <el-table-column label="用户" min-width="240">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar
                :size="42"
                :src="normalizeAssetUrl(row.avatarUrl)"
              >
                {{ avatarText(row.nickname) }}
              </el-avatar>
              <div class="user-meta">
                <div class="nickname">{{ row.nickname || '-' }}</div>
                <div class="muted">{{ row.id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="日记数" width="90">
          <template #default="{ row }">{{ row.diaryEntryCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="完成章节" width="100">
          <template #default="{ row }">{{ row.completedChapterCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="生成任务" width="100">
          <template #default="{ row }">{{ row.generationTaskCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="任务摘要" min-width="160">
          <template #default="{ row }">
            生成中 {{ row.generatingTaskCount || 0 }} / 失败 {{ row.failedTaskCount || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="最近章节时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.latestDiaryAt) }}</template>
        </el-table-column>
        <el-table-column label="最近任务时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.latestGenerationTaskAt) }}</template>
        </el-table-column>
        <el-table-column label="角色档案" width="100">
          <template #default="{ row }">
            <el-tag :type="row.hasCharacterProfile ? 'success' : 'info'" effect="light">
              {{ row.hasCharacterProfile ? '已填写' : '未填写' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="goDetail(row.id)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="loadUsers"
        />
      </div>
    </el-card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { listAdminUsers } from '../api/adminUsers'
import { formatTime, normalizeAssetUrl } from '../utils/taskFormat'

const router = useRouter()
const loading = ref(false)
const items = ref([])
const filters = reactive({
  keyword: '',
  dateFrom: '',
  dateTo: '',
})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

async function loadUsers() {
  loading.value = true

  try {
    const data = await listAdminUsers({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: filters.keyword || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    })
    items.value = data.items || []
    pagination.page = data.pagination.page
    pagination.pageSize = data.pagination.pageSize
    pagination.total = data.pagination.total
  } catch (err) {
    ElMessage.error(err.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadUsers()
}

function resetFilters() {
  filters.keyword = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  pagination.page = 1
  loadUsers()
}

function handlePageSizeChange() {
  pagination.page = 1
  loadUsers()
}

function goDetail(id) {
  router.push(`/users/${id}`)
}

function avatarText(nickname) {
  return (nickname || '用户').slice(0, 1)
}

onMounted(loadUsers)
</script>

<style scoped>
.user-page {
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

.filter-card {
  border-radius: 8px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}

.keyword-input {
  width: 260px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-meta {
  min-width: 0;
}

.nickname {
  font-weight: 600;
  color: #1f2937;
}

.muted {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
  word-break: break-all;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
