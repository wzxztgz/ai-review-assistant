<template>
  <div class="exam-list-page">
    <!-- 头部 -->
    <header class="page-header">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="page-title">真题库</h1>
      <div class="points-display">
        <span class="points-icon">🎁</span>
        <span class="points-value">{{ userPoints }} 积分</span>
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索课程名称..."
        class="search-input"
      />
      <select v-model="filterYear" class="filter-select">
        <option value="">全部年份</option>
        <option v-for="year in availableYears" :key="year" :value="year">{{ year }}年</option>
      </select>
    </div>

    <!-- 真题列表 -->
    <div class="exam-list" v-if="!loading">
      <div v-if="exams.length === 0" class="empty-state">
        <span class="empty-icon">📚</span>
        <p class="empty-text">暂无真题</p>
        <p class="empty-hint">上传真题可获得积分奖励</p>
      </div>

      <div
        v-for="exam in filteredExams"
        :key="exam.id"
        class="exam-card"
        @click="viewExam(exam)"
      >
        <div class="exam-header">
          <span class="exam-year">{{ exam.year || '未知年份' }}</span>
          <span class="exam-type">{{ exam.exam_type || '期末' }}</span>
        </div>
        <h3 class="exam-title">{{ exam.course_name }}</h3>
        <div class="exam-meta">
          <span v-if="exam.school" class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
            </svg>
            {{ exam.school }}
          </span>
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {{ exam.question_count || 0 }} 题
          </span>
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {{ exam.download_count || 0 }} 次解锁
          </span>
        </div>
        <div class="exam-footer">
          <span class="unlock-cost">🔒 10积分解锁</span>
          <span class="view-btn">查看详情 →</span>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-else class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getExamList, getUserPoints } from '../api'
import { getLocalPoints } from '../utils/session'

const router = useRouter()

const exams = ref([])
const loading = ref(true)
const userPoints = ref(getLocalPoints())
const searchKeyword = ref('')
const filterYear = ref('')

const availableYears = computed(() => {
  const years = new Set()
  exams.value.forEach(exam => {
    if (exam.year) years.add(exam.year)
  })
  return Array.from(years).sort((a, b) => b - a)
})

const filteredExams = computed(() => {
  let result = exams.value
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(exam => 
      exam.course_name?.toLowerCase().includes(keyword) ||
      exam.school?.toLowerCase().includes(keyword)
    )
  }
  
  if (filterYear.value) {
    result = result.filter(exam => exam.year === parseInt(filterYear.value))
  }
  
  return result
})

async function loadExams() {
  try {
    const data = await getExamList()
    exams.value = data || []
  } catch (error) {
    console.error('加载真题列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadPoints() {
  try {
    const data = await getUserPoints()
    userPoints.value = data.points
  } catch (error) {
    // 使用本地缓存
  }
}

function viewExam(exam) {
  router.push(`/exam/${exam.id}`)
}

function goBack() {
  router.push('/')
}

onMounted(() => {
  loadExams()
  loadPoints()
})
</script>

<style scoped>
.exam-list-page {
  min-height: 100vh;
  background: var(--bg-secondary);
}

/* 头部 */
.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--primary);
  color: white;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.back-btn svg {
  width: 20px;
  height: 20px;
}

.page-title {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.points-display {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.points-icon {
  font-size: 1rem;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: white;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  flex: 1;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  background: var(--bg-secondary);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  background: white;
}

.filter-select {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  background: var(--bg-secondary);
  min-width: 120px;
}

/* 真题列表 */
.exam-list {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.exam-card {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.exam-card:hover {
  border-color: var(--primary-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.exam-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.exam-year {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-lightest);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.exam-type {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.exam-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.exam-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.meta-item svg {
  width: 14px;
  height: 14px;
}

.exam-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.unlock-cost {
  font-size: 0.8125rem;
  color: #f59e0b;
  font-weight: 500;
}

.view-btn {
  font-size: 0.8125rem;
  color: var(--primary);
  font-weight: 500;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-text {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin: 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
