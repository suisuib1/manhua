<template>
  <section class="task-page">
    <div class="page-heading">
      <h1>生成任务</h1>
      <el-button :loading="loading" @click="loadTasks">刷新</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable class="status-select">
            <el-option label="全部" value="" />
            <el-option label="等待中" value="pending" />
            <el-option label="生成中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>

        <el-form-item label="关键词">
          <el-input
            v-model.trim="filters.keyword"
            clearable
            placeholder="任务 ID / 日记 ID / 用户 ID"
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
        empty-text="暂无生成任务"
        style="width: 100%"
      >
        <el-table-column prop="id" label="任务 ID" min-width="180" show-overflow-tooltip />
        <el-table-column prop="diaryEntryId" label="日记 ID" min-width="180" show-overflow-tooltip />
        <el-table-column label="用户" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.userNickname || row.ownerUserId || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="diaryTitle" label="日记标题" min-width="160" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="light">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="图片" width="90">
          <template #default="{ row }">
            {{ row.hasImage ? '有图' : '无图' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="开始时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.finishedAt) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="100">
          <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误摘要" min-width="220" show-overflow-tooltip />
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
          @current-change="loadTasks"
        />
      </div>
    </el-card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { getGenerationTasks } from '../api/generationTasks'
import {
  formatDuration,
  formatTime,
  statusText,
  statusType,
} from '../utils/taskFormat'

const router = useRouter()
const loading = ref(false)
const items = ref([])
const filters = reactive({
  status: '',
  keyword: '',
  dateFrom: '',
  dateTo: '',
})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

async function loadTasks() {
  loading.value = true

  try {
    const data = await getGenerationTasks({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    })
    items.value = data.items || []
    pagination.page = data.pagination.page
    pagination.pageSize = data.pagination.pageSize
    pagination.total = data.pagination.total
  } catch (err) {
    ElMessage.error(err.message || '生成任务加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  loadTasks()
}

function resetFilters() {
  filters.status = ''
  filters.keyword = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  pagination.page = 1
  loadTasks()
}

function handlePageSizeChange() {
  pagination.page = 1
  loadTasks()
}

function goDetail(id) {
  router.push(`/generation-tasks/${id}`)
}

onMounted(loadTasks)
</script>

<style scoped>
.task-page {
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

.status-select {
  width: 140px;
}

.keyword-input {
  width: 260px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
