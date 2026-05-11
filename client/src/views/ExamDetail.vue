<template>
  <div class="exam-detail-page">
    <!-- 头部 -->
    <header class="page-header">
      <button class="back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="page-title">{{ exam?.course_name || '真题详情' }}</h1>
      <div class="points-display">
        <span class="points-icon">🎁</span>
        <span class="points-value">{{ userPoints }} 积分</span>
      </div>
    </header>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 未解锁状态 -->
    <div v-else-if="!isUnlocked" class="unlock-panel">
      <div class="unlock-card">
        <span class="unlock-icon">🔒</span>
        <h2 class="unlock-title">解锁真题</h2>
        <p class="unlock-desc">
          使用 <strong>10 积分</strong> 解锁此真题的所有题目和答案
        </p>
        <div class="unlock-info">
          <div class="info-item">
            <span class="info-label">课程</span>
            <span class="info-value">{{ exam?.course_name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">年份</span>
            <span class="info-value">{{ exam?.year || '未知' }}年</span>
          </div>
          <div class="info-item">
            <span class="info-label">题目数</span>
            <span class="info-value">{{ exam?.question_count || 0 }} 题</span>
          </div>
        </div>
        <button
          class="unlock-btn"
          :disabled="unlocking || userPoints < 10"
          @click="handleUnlock"
        >
          <span v-if="unlocking" class="loading-spinner-small"></span>
          <span v-else-if="userPoints < 10">积分不足</span>
          <span v-else>🔓 解锁真题 (10积分)</span>
        </button>
        <p v-if="userPoints < 10" class="points-hint">
          当前积分：{{ userPoints }}，还需 {{ 10 - userPoints }} 积分
        </p>
      </div>
    </div>

    <!-- 已解锁内容 -->
    <div v-else class="exam-content">
      <!-- 基本信息 -->
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">课程名称</span>
          <span class="info-value">{{ exam?.course_name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">考试时间</span>
          <span class="info-value">{{ exam?.year }}年 {{ exam?.semester || '' }} {{ exam?.exam_type || '期末' }}</span>
        </div>
        <div class="info-row" v-if="exam?.school">
          <span class="info-label">学校</span>
          <span class="info-value">{{ exam?.school }}</span>
        </div>
      </div>

      <!-- 题目列表 -->
      <div class="questions-section">
        <h2 class="section-title">
          <span>📋 题目列表</span>
          <span class="question-count">共 {{ questions.length }} 题</span>
        </h2>

        <div v-if="questions.length === 0" class="empty-questions">
          <p>暂无题目数据</p>
        </div>

        <div v-else class="questions-list">
          <div
            v-for="(question, index) in questions"
            :key="question.id"
            class="question-card"
          >
            <div class="question-header">
              <span class="question-number">{{ question.question_number || `${index + 1}` }}</span>
              <span class="question-type" :class="question.question_type">
                {{ question.question_type }}
              </span>
              <span class="question-score" v-if="question.score">{{ question.score }}分</span>
            </div>
            <div class="question-content">{{ question.content }}</div>
            
            <!-- 答案（如果有） -->
            <div v-if="question.answer" class="question-answer">
              <span class="answer-label">答案：</span>
              <span class="answer-content">{{ question.answer }}</span>
            </div>

            <!-- 知识点标签 -->
            <div v-if="question.knowledge_point" class="question-tags">
              <span class="tag chapter" v-if="question.chapter">{{ question.chapter }}</span>
              <span class="tag kp">{{ question.knowledge_point }}</span>
              <span class="tag difficulty" v-if="question.difficulty !== '未知'" :class="question.difficulty">
                {{ question.difficulty }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getExamQuestions, unlockExam, getUserPoints } from '../api'
import { getLocalPoints, setLocalPoints } from '../utils/session'

const router = useRouter()
const route = useRoute()

const exam = ref(null)
const questions = ref([])
const loading = ref(true)
const unlocking = ref(false)
const isUnlocked = ref(false)
const userPoints = ref(getLocalPoints())

const examId = computed(() => route.params.id)

async function loadExamDetail() {
  loading.value = true
  try {
    const data = await getExamQuestions(examId.value)
    exam.value = data.exam
    questions.value = data.questions || []
    isUnlocked.value = data.isUnlocked || false
  } catch (error) {
    console.error('加载真题详情失败:', error)
    if (error.code === 'FORBIDDEN') {
      isUnlocked.value = false
    }
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

async function handleUnlock() {
  if (unlocking.value || userPoints.value < 10) return

  unlocking.value = true
  try {
    const result = await unlockExam(examId.value)
    
    if (result.alreadyUnlocked || result.unlocked) {
      isUnlocked.value = true
      userPoints.value = result.remainingPoints ?? (userPoints.value - 10)
      setLocalPoints(userPoints.value)
      
      // 重新加载题目
      await loadExamDetail()
    }
  } catch (error) {
    console.error('解锁失败:', error)
    alert(error.message || '解锁失败，请重试')
  } finally {
    unlocking.value = false
  }
}

function goBack() {
  router.push('/exam')
}

onMounted(() => {
  loadExamDetail()
  loadPoints()
})
</script>

<style scoped>
.exam-detail-page {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 解锁面板 */
.unlock-panel {
  padding: 2rem 1.25rem;
  display: flex;
  justify-content: center;
}

.unlock-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.unlock-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.unlock-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.unlock-desc {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.unlock-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.unlock-btn {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 12px;
  background: var(--primary);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.unlock-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}

.unlock-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.points-hint {
  font-size: 0.8125rem;
  color: #f59e0b;
  margin: 0.75rem 0 0;
}

/* 已解锁内容 */
.exam-content {
  padding: 1rem 1.25rem;
}

.info-section {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row .info-label {
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.info-row .info-value {
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
}

/* 题目列表 */
.questions-section {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.question-count {
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--text-tertiary);
}

.empty-questions {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question-card {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.question-number {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-lightest);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.question-type {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: #e5e7eb;
  color: #374151;
}

.question-type.选择 { background: #dbeafe; color: #1e40af; }
.question-type.填空 { background: #fef3c7; color: #92400e; }
.question-type.计算 { background: #d1fae5; color: #065f46; }
.question-type.简答 { background: #ede9fe; color: #5b21b6; }

.question-score {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-left: auto;
}

.question-content {
  font-size: 0.9375rem;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.question-answer {
  padding: 0.75rem;
  background: #ecfdf5;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.answer-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #065f46;
}

.answer-content {
  font-size: 0.875rem;
  color: #047857;
}

.question-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.tag {
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.tag.chapter {
  background: #f3f4f6;
  color: #4b5563;
}

.tag.kp {
  background: var(--primary-lightest);
  color: var(--primary);
}

.tag.difficulty.易 { background: #d1fae5; color: #065f46; }
.tag.difficulty.中 { background: #fef3c7; color: #92400e; }
.tag.difficulty.难 { background: #fee2e2; color: #991b1b; }
</style>
