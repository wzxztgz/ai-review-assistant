<template>
  <div class="home-page">
    <!-- 头部 -->
    <header class="home-header">
      <!-- 积分徽章（右上角绝对定位） -->
      <div class="points-badge" v-if="userPoints > 0">
        <span class="points-icon">🎁</span>
        <span class="points-value">{{ userPoints }} 积分</span>
      </div>
      
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="10" fill="var(--primary)" />
              <path d="M12 28V14l8 5 8-5v14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="20" cy="12" r="2" fill="white" />
            </svg>
          </div>
          <h1 class="app-title">AI 复习助手</h1>
        </div>
        <p class="app-subtitle">上传课程资料，AI帮你生成高效复习计划</p>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="home-main">
      <!-- 文件上传区域 -->
      <section class="section upload-section">
        <h2 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          上传课程资料
        </h2>
        <FileUpload />
      </section>

      <!-- 复习场景选择 -->
      <section class="section scenario-section">
        <h2 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          请选择你的复习场景
        </h2>

        <div class="scenario-grid">
          <button
            v-for="scenario in scenarioOptions"
            :key="scenario.value"
            :class="['scenario-card', { active: activeScenario === scenario.value }]"
            @click="selectScenario(scenario.value)"
          >
            <div class="scenario-icon">{{ scenario.icon }}</div>
            <div class="scenario-name">{{ scenario.name }}</div>
            <div class="scenario-desc">{{ scenario.desc }}</div>
            <div class="scenario-tags">
              <span v-for="tag in scenario.tags" :key="tag" class="scenario-tag">{{ tag }}</span>
            </div>
          </button>
        </div>
      </section>

      <!-- 开始分析按钮 -->
      <div class="action-bar">
        <button
          class="btn-start"
          :disabled="!canStart"
          @click="handleStartAnalysis"
        >
          <svg v-if="!isStarting" class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span v-if="isStarting" class="spinner-small"></span>
          {{ isStarting ? '正在提交...' : '开始分析' }}
        </button>
        <p class="action-hint" v-if="!store.hasFiles">
          请先上传至少一个文件
        </p>
        <p class="action-hint" v-else>
          已选择 {{ store.files.length }} 个文件，共 {{ store.totalFileSize }}
        </p>
      </div>
    </main>

    <!-- 真题共享授权弹窗 -->
    <ExamConsentModal
      :visible="showConsentModal"
      :exam-files="examFiles"
      :analysis-id="analysisId"
      @close="handleConsentClose"
      @consent="handleConsentAgree"
      @decline="handleConsentDecline"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalysisStore } from '../stores/analysis'
import { getUserPoints } from '../api'
import { getLocalPoints } from '../utils/session'
import FileUpload from '../components/FileUpload.vue'
import ExamConsentModal from '../components/ExamConsentModal.vue'

const router = useRouter()
const store = useAnalysisStore()
const isStarting = ref(false)

// 用户积分
const userPoints = ref(getLocalPoints())

// 页面加载时获取最新积分
onMounted(async () => {
  try {
    const data = await getUserPoints()
    userPoints.value = data.points
  } catch (e) {
    // 忽略错误，使用本地缓存
  }
})

// 真题授权弹窗状态
const showConsentModal = ref(false)
const examFiles = ref([])
const analysisId = ref('')
const examConsentResult = ref(null) // null=未选择, true=同意, false=拒绝

// 监听文件变化，检测是否有真题
watch(() => store.files, (files) => {
  if (files.length > 0) {
    const exams = files.filter(f => f.type === 'exam')
    if (exams.length > 0 && examConsentResult.value === null) {
      examFiles.value = exams
    }
  }
}, { deep: true })

// 复习场景选项
const scenarioOptions = [
  {
    value: 'emergency',
    name: '急救',
    icon: '🚀',
    desc: '时间紧，只想抓重点',
    tags: ['简洁模式', '急救文档'],
    config: { targetGrade: 'pass', detailLevel: 'concise', priorityMode: 'emergency' },
  },
  {
    value: 'standard',
    name: '标准',
    icon: '📚',
    desc: '正常复习，平衡效率',
    tags: ['标准模式', '完整文档'],
    config: { targetGrade: 'good', detailLevel: 'normal', priorityMode: 'normal' },
  },
  {
    value: 'sprint',
    name: '冲刺',
    icon: '🎯',
    desc: '时间充裕，追求高分',
    tags: ['详细模式', '全面复习'],
    config: { targetGrade: 'excellent', detailLevel: 'detailed', priorityMode: 'normal' },
  },
]

const activeScenario = ref('standard')

function selectScenario(value) {
  activeScenario.value = value
  const scenario = scenarioOptions.find(s => s.value === value)
  if (scenario) {
    store.setConfig('targetGrade', scenario.config.targetGrade)
    store.setConfig('detailLevel', scenario.config.detailLevel)
  }
}

const canStart = computed(() => {
  return store.hasFiles && !isStarting.value
})

async function handleStartAnalysis() {
  if (!canStart.value) return

  // 如果有真题且用户还没做选择，先弹出授权弹窗
  const exams = store.files.filter(f => f.type === 'exam')
  if (exams.length > 0 && examConsentResult.value === null) {
    analysisId.value = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    showConsentModal.value = true
    return
  }

  // 开始分析
  doStartAnalysis()
}

function doStartAnalysis() {
  isStarting.value = true
  store.setError(null)

  try {
    const scenario = scenarioOptions.find(s => s.value === activeScenario.value)

    const params = {
      files: store.files.map((f) => ({
        id: f.id,
        path: f.path,
        originalName: f.originalName,
        type: f.type,
      })),
      config: {
        courseName: store.config.courseName,
        examDate: store.config.examDate,
        priorityMode: scenario?.config.priorityMode || 'normal',
        detailLevel: store.config.detailLevel,
        targetGrade: store.config.targetGrade,
        remainingDays: store.config.remainingDays,
        ocrMode: store.config.ocrMode || 'slow',
        examShareConsent: examConsentResult.value, // 传递授权结果
      },
    }

    store.setStatus('analyzing')
    router.push('/analyzing')
  } catch (err) {
    store.setError(err.message || '启动分析失败')
    isStarting.value = false
  }
}

// 授权弹窗回调
function handleConsentClose() {
  showConsentModal.value = false
}

function handleConsentAgree({ agreed, files }) {
  examConsentResult.value = agreed
  showConsentModal.value = false
  // 自动开始分析
  doStartAnalysis()
}

function handleConsentDecline({ agreed, files }) {
  examConsentResult.value = agreed
  showConsentModal.value = false
  // 自动开始分析
  doStartAnalysis()
}

function goToExamList() {
  router.push('/exam')
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

/* 头部 */
.home-header {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  padding: 3rem 1.5rem 2.5rem;
  text-align: center;
  color: white;
  position: relative;
}

.header-content {
  max-width: 640px;
  margin: 0 auto;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.logo-icon svg {
  width: 100%;
  height: 100%;
}

.app-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
}

.app-subtitle {
  font-size: 1rem;
  opacity: 0.9;
  margin: 0;
  text-align: center;
}

.points-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 20px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #92400e;
  border: 1px solid #fcd34d;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.points-icon {
  font-size: 0.875rem;
}

/* 主内容 */
.home-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

/* 区块 */
.section {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
}

.section-icon {
  width: 20px;
  height: 20px;
  color: var(--primary);
  flex-shrink: 0;
}

/* 场景选择 */
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.scenario-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1.25rem 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.scenario-card:hover {
  border-color: var(--primary-light);
  background: var(--primary-lightest);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.scenario-card.active {
  border-color: var(--primary);
  background: var(--primary-lightest);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.scenario-icon {
  font-size: 2rem;
  line-height: 1;
}

.scenario-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.scenario-card.active .scenario-name {
  color: var(--primary);
}

.scenario-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.scenario-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.scenario-tag {
  display: inline-block;
  padding: 0.125rem 0.4375rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.scenario-card.active .scenario-tag {
  background: white;
  border-color: rgba(59, 130, 246, 0.2);
  color: var(--primary);
}

/* 操作栏 */
.action-bar {
  text-align: center;
  padding: 0.5rem 0;
}

/* 真题库入口 */
.exam-link-section {
  text-align: center;
  padding: 1rem 0;
  margin-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.exam-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border: 1px solid #fcd34d;
  border-radius: 12px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #92400e;
  cursor: pointer;
  transition: all 0.2s;
}

.exam-link-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.exam-link-btn svg {
  width: 20px;
  height: 20px;
}

.exam-link-hint {
  font-size: 0.75rem;
  color: #b45309;
  opacity: 0.8;
}

.btn-start {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 2.5rem;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.0625rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
  min-width: 200px;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45);
}

.btn-start:active:not(:disabled) {
  transform: translateY(0);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.action-hint {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin: 0.625rem 0 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .home-header {
    padding: 2rem 1rem 2rem;
  }

  .app-title {
    font-size: 1.5rem;
  }

  .app-subtitle {
    font-size: 0.875rem;
  }

  .section {
    padding: 1.25rem;
    border-radius: 12px;
  }

  .scenario-grid {
    grid-template-columns: 1fr;
    gap: 0.625rem;
  }

  .scenario-card {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    text-align: left;
  }

  .scenario-icon {
    font-size: 1.5rem;
  }

  .scenario-tags {
    justify-content: flex-start;
  }

  .btn-start {
    width: 100%;
    padding: 0.875rem 1.5rem;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
