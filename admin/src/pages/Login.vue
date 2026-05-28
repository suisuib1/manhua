<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-heading">
        <h1>日记漫画后台</h1>
        <p>管理员登录</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model.trim="form.username"
            autocomplete="username"
            placeholder="请输入用户名"
            size="large"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            autocomplete="current-password"
            placeholder="请输入密码"
            show-password
            size="large"
            type="password"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-button
          class="login-button"
          type="primary"
          size="large"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const formRef = ref(null)
const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (loading.value) return

  try {
    await formRef.value.validate()
  } catch (err) {
    return
  }

  loading.value = true

  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.replace('/dashboard')
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #f5f7fb;
}

.login-panel {
  width: 380px;
  padding: 32px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(31, 41, 55, 0.08);
}

.login-heading {
  margin-bottom: 28px;
}

.login-heading h1 {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.3;
}

.login-heading p {
  margin: 0;
  color: #6b7280;
}

.login-button {
  width: 100%;
  margin-top: 8px;
}
</style>
