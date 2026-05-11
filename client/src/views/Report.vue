<template>
  <div class="report-page">
    <!-- 顶部工具栏 -->
    <header class="report-header">
      <div class="header-left">
        <button class="btn-back" @click="goHome" title="返回首页">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 class="header-title">
          {{ store.viewMode === 'emergency' ? '急救复习' : '复习报告' }}
        </h1>
      </div>
      <div class="header-right">
        <ModeSwitch
          :model-value="store.viewMode"
          @update:model-value="store.toggleViewMode()"
        />
      </div>
    </header>

    <!-- 加载状态 -->
    <div v-if="!store.analysisResult" class="loading-state">
      <span class="spinner-large"></span>
      <p>正在加载报告...</p>
    </div>

    <!-- 报告内容 -->
    <template v-else>
      <!-- 元数据信息栏 -->
      <div class="meta-bar" v-if="store.metadata">
        <div class="meta-item">
          <span class="meta-label">课程</span>
          <span class="meta-value">{{ store.metadata.courseName }}</span>
        </div>
        <div class="meta-item" v-if="store.metadata.processingTime">
          <span class="meta-label">耗时</span>
          <span class="meta-value">{{ (store.metadata.processingTime / 1000).toFixed(1) }}s</span>
        </div>
        <div class="meta-item" v-if="store.metadata.totalChars">
          <span class="meta-label">资料量</span>
          <span class="meta-value">{{ formatChars(store.metadata.totalChars) }}</span>
        </div>
        <div class="meta-item" v-if="store.metadata.confidence">
          <span class="meta-label">可信度</span>
          <span class="meta-value">{{ Math.round(store.metadata.confidence * 100) }}%</span>
        </div>
      </div>

      <!-- 急救模式 -->
      <div v-if="store.viewMode === 'emergency'" class="emergency-content">
        <div class="emergency-card" v-if="emergencyDoc">
          <h2 class="emergency-title">{{ emergencyDoc.title || '考前急救文档' }}</h2>

          <!-- 必记要点 -->
          <div v-if="emergencyDoc.mustRemember?.length" class="emergency-section">
            <h3 class="emergency-section-title">必记要点</h3>
            <ul class="must-remember-list">
              <li v-for="(item, i) in emergencyDoc.mustRemember" :key="i">{{ item }}</li>
            </ul>
          </div>

          <!-- 急救内容 -->
          <div v-if="emergencyDoc.content" class="emergency-section">
            <h3 class="emergency-section-title">急救复习内容</h3>
            <div class="markdown-content" v-html="renderMarkdown(emergencyDoc.content)"></div>
          </div>

          <!-- 快速复习 -->
          <div v-if="emergencyDoc.quickReview" class="emergency-section">
            <h3 class="emergency-section-title">快速复习清单</h3>
            <div class="markdown-content" v-html="renderMarkdown(emergencyDoc.quickReview)"></div>
          </div>

          <!-- 考试技巧 -->
          <div v-if="emergencyDoc.examTips?.length" class="emergency-section">
            <h3 class="emergency-section-title">考试技巧</h3>
            <ul class="exam-tips-list">
              <li v-for="(tip, i) in emergencyDoc.examTips" :key="i">{{ tip }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 正常模式 -->
      <div v-else class="normal-content">
        <!-- 优先级报告摘要 -->
        <section class="priority-summary" v-if="store.priorityReport">
          <h2 class="section-heading">复习优先级概览</h2>
          <p class="summary-text" v-if="store.priorityReport.summary">
            {{ store.priorityReport.summary }}
          </p>

          <!-- 题型分布（仅有真题时显示） -->
          <div v-if="questionTypeDistribution && hasExamData" class="question-type-section">
            <h3 class="section-subtitle">题型分布</h3>
            <div class="question-type-grid">
              <div v-for="(count, type) in questionTypeDistribution" :key="type" class="qt-item">
                <span class="qt-type">{{ type }}</span>
                <span class="qt-count">{{ count }}次</span>
              </div>
            </div>
          </div>

          <!-- 优先级统计 -->
          <div class="priority-stats">
            <div class="stat-card stat-high">
              <div class="stat-info">
                <span class="stat-count">{{ highCount }}</span>
                <span class="stat-label">{{ highLabel }}</span>
              </div>
            </div>
            <div class="stat-card stat-medium">
              <div class="stat-info">
                <span class="stat-count">{{ mediumCount }}</span>
                <span class="stat-label">{{ mediumLabel }}</span>
              </div>
            </div>
            <div class="stat-card stat-low">
              <div class="stat-info">
                <span class="stat-count">{{ lowCount }}</span>
                <span class="stat-label">{{ lowLabel }}</span>
              </div>
            </div>
          </div>

          <!-- 额外统计 -->
          <div class="extra-stats" v-if="store.priorityReport.estimatedStudyHours || store.priorityReport.difficulty">
            <div class="extra-stat" v-if="store.priorityReport.estimatedStudyHours">
              <span class="extra-stat-value">{{ store.priorityReport.estimatedStudyHours }}h</span>
              <span class="extra-stat-label">预估复习时长</span>
            </div>
            <div class="extra-stat" v-if="store.priorityReport.difficulty">
              <span class="extra-stat-value">{{ difficultyLabel }}</span>
              <span class="extra-stat-label">难度评估</span>
            </div>
            <div class="extra-stat" v-if="store.priorityReport.totalKnowledgePoints">
              <span class="extra-stat-value">{{ store.priorityReport.totalKnowledgePoints }}</span>
              <span class="extra-stat-label">知识点总数</span>
            </div>
          </div>
        </section>

        <!-- 完整复习文档 -->
        <section class="full-document" v-if="fullDoc">
          <h2 class="section-heading">{{ fullDoc.title || '完整复习文档' }}</h2>

          <p class="doc-summary" v-if="fullDoc.summary">
            {{ fullDoc.summary }}
          </p>

          <!-- 知识点组列表 -->
          <div class="knowledge-groups">
            <KnowledgeGroup
              v-for="section in fullDoc.sections"
              :key="section.id || section.title"
              :section="section"
            />
          </div>

          <!-- 无内容提示 -->
          <div v-if="!fullDoc.sections?.length" class="empty-state">
            <p>暂无复习文档内容</p>
          </div>

          <!-- 导出按钮 -->
          <div class="export-dropdown document-export">
            <button
              class="btn-export"
              @click="showExportMenu = !showExportMenu"
              :disabled="isExporting"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{{ isExporting ? '导出中...' : '导出报告' }}</span>
              <svg class="export-arrow" :class="{ open: showExportMenu }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div v-if="showExportMenu" class="export-menu">
              <button @click="handleExport('markdown')" class="export-option">
                <span class="export-icon">📝</span>
                <span>Markdown</span>
              </button>
              <button @click="handleExport('docx')" class="export-option">
                <span class="export-icon">📄</span>
                <span>Word 文档</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- 质量评估 -->
      <div v-if="qualityAssessment" class="quality-section">
        <h3 class="quality-title">分析质量评估</h3>
        <div class="quality-metrics">
          <div class="quality-metric" v-if="qualityAssessment.overallConfidence">
            <span class="metric-label">整体置信度</span>
            <span class="metric-value">{{ Math.round(qualityAssessment.overallConfidence * 100) }}%</span>
          </div>
          <div class="quality-metric" v-if="qualityAssessment.completeness">
            <span class="metric-label">完整度</span>
            <span class="metric-value">{{ Math.round(qualityAssessment.completeness * 100) }}%</span>
          </div>
          <div class="quality-metric" v-if="qualityAssessment.accuracy">
            <span class="metric-label">准确度</span>
            <span class="metric-value">{{ Math.round(qualityAssessment.accuracy * 100) }}%</span>
          </div>
        </div>
        <div v-if="qualityAssessment.issues?.length" class="quality-issues">
          <p class="issues-label">发现的问题：</p>
          <ul>
            <li v-for="(issue, i) in qualityAssessment.issues" :key="i">{{ issue }}</li>
          </ul>
        </div>
      </div>

      <!-- 警告信息 -->
      <div v-if="store.metadata?.warnings?.length" class="warnings-section">
        <div v-for="(warning, i) in store.metadata.warnings" :key="i" class="warning-item">
          <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{{ warning }}</span>
        </div>
      </div>

      <!-- 反馈栏 -->
      <FeedbackBar v-if="showFeedback" :analysis-id="store.analysisId" @close="showFeedback = false" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAnalysisStore } from '../stores/analysis'
import { exportReport } from '../api'
import ModeSwitch from '../components/ModeSwitch.vue'
import KnowledgeGroup from '../components/KnowledgeGroup.vue'
import FeedbackBar from '../components/FeedbackBar.vue'

const router = useRouter()
const route = useRoute()
const store = useAnalysisStore()

// 急救文档
const emergencyDoc = computed(() => store.analysisResult?.emergencyDocument || null)

// 完整文档
const fullDoc = computed(() => store.analysisResult?.fullDocument || null)

// 质量评估
const qualityAssessment = computed(() => store.analysisResult?.qualityAssessment || null)

// 题型分布
const questionTypeDistribution = computed(() => store.priorityReport?.questionTypeDistribution || null)

// 是否有真题数据
const hasExamData = computed(() => {
  const materialTypes = store.metadata?.materialTypes || []
  return materialTypes.includes('exam') || materialTypes.includes('真题')
})

// 优先级统计
const highCount = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.mustKnow?.count || levels?.mustKnow?.points?.length || 0
})

const mediumCount = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.important?.count || levels?.important?.points?.length || 0
})

const lowCount = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.review?.count || levels?.review?.points?.length || 0
})

// 优先级标签（从AI返回结果中获取）
const highLabel = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.mustKnow?.label || '核心重点'
})

const mediumLabel = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.important?.label || '重要内容'
})

const lowLabel = computed(() => {
  const levels = store.priorityReport?.priorityLevels
  return levels?.review?.label || '了解即可'
})

const difficultyLabel = computed(() => {
  const map = { easy: '简单', medium: '中等', hard: '困难' }
  return map[store.priorityReport?.difficulty] || store.priorityReport?.difficulty || '未知'
})

function formatChars(chars) {
  if (chars < 1000) return `${chars} 字`
  if (chars < 10000) return `${(chars / 1000).toFixed(1)}k 字`
  return `${(chars / 10000).toFixed(1)}w 字`
}

/**
 * 简单的 Markdown 渲染
 * 支持: 标题、粗体、斜体、列表、代码块、行内代码、链接
 */
function renderMarkdown(text) {
  if (!text) return ''
  let html = text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // 标题
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // 粗体和斜体
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 无序列表
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 分割线
    .replace(/^---$/gm, '<hr />')
    // 换行
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')

  // 包裹连续的 li
  html = html.replace(/((?:<li>.*?<\/li>(?:<br \/>)?)+)/g, '<ul>$1</ul>')
  // 去掉 li 后多余的 br
  html = html.replace(/<\/li><br \/>/g, '</li>')

  return `<p>${html}</p>`
}

// 导出功能
const showExportMenu = ref(false)
const isExporting = ref(false)

// 反馈栏显示控制
const showFeedback = ref(true)

async function handleExport(format) {
  if (isExporting.value) return

  isExporting.value = true
  showExportMenu.value = false

  try {
    const blob = await exportReport({
      result: store.analysisResult,
      format,
    })

    // 下载文件
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.metadata?.courseName || '复习报告'}_${new Date().toISOString().slice(0, 10)}.${format === 'markdown' ? 'md' : format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    alert(`导出失败: ${error.message || '请重试'}`)
  } finally {
    isExporting.value = false
  }
}

function goHome() {
  store.reset()
  router.push('/')
}

onMounted(() => {
  // 如果没有分析结果，跳转回首页
  if (!store.analysisResult) {
    router.push('/')
  }
})
</script>

<style scoped>
.report-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 5rem; /* 为底部 FeedbackBar 留出空间 */
}

/* 顶部工具栏 */
.report-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-back svg {
  width: 18px;
  height: 18px;
}

.header-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

/* 导出下拉菜单 */
.export-dropdown {
  position: relative;
}

/* 文档底部的导出按钮居中 */
.export-dropdown.document-export {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-export {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export:hover:not(:disabled) {
  border-color: var(--primary-light);
  background: var(--primary-lightest);
  color: var(--primary);
}

.btn-export:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-export svg {
  width: 16px;
  height: 16px;
}

.btn-export svg:first-of-type {
  width: 18px;
  height: 18px;
}

.export-arrow {
  transition: transform 0.2s;
  margin-left: 0.125rem;
}

.export-arrow.open {
  transform: rotate(180deg);
}

.export-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 160px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 0.375rem;
  z-index: 200;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.export-option:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.export-icon {
  font-size: 1.125rem;
}

/* 元数据栏 */
.meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.8125rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.meta-label {
  color: var(--text-tertiary);
}

.meta-value {
  color: var(--text-secondary);
  font-weight: 500;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  gap: 1rem;
  color: var(--text-tertiary);
}

.spinner-large {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 内容区域 */
.normal-content,
.emergency-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 1.5rem 1rem 6rem;
}

/* 区块标题 */
.section-heading {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--primary-light);
}

/* 优先级摘要 */
.priority-summary {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.summary-text {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 1.25rem;
}

.priority-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

/* 题型分布 */
.question-type-section {
  margin-bottom: 1.25rem;
}

.question-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.qt-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.qt-type {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.qt-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.stat-high {
  background: linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%);
  border-color: #fecaca;
}

.stat-medium {
  background: linear-gradient(135deg, #fff7ed 0%, #fffbf5 100%);
  border-color: #fed7aa;
}

.stat-low {
  background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
  border-color: #e5e7eb;
}

.stat-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-count {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-high .stat-count { color: var(--danger); }
.stat-medium .stat-count { color: var(--warning-dark); }
.stat-low .stat-count { color: var(--text-tertiary); }

.stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* 额外统计 */
.extra-stats {
  display: flex;
  gap: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.extra-stat {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.extra-stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.extra-stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 完整文档 */
.full-document {
  margin-bottom: 1.5rem;
}

.doc-summary {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border-left: 4px solid var(--primary);
}

.knowledge-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 急救模式 */
.emergency-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--danger);
}

.emergency-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--danger);
  margin: 0 0 1.25rem;
}

.emergency-section {
  margin-bottom: 1.5rem;
}

.emergency-section:last-child {
  margin-bottom: 0;
}

.emergency-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid var(--border-color);
}

.must-remember-list,
.exam-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.must-remember-list li,
.exam-tips-list li {
  padding: 0.625rem 0.875rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary);
  line-height: 1.5;
  border-left: 3px solid var(--danger);
}

.exam-tips-list li {
  border-left-color: var(--primary);
}

/* Markdown 内容 */
.markdown-content {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--text-primary);
}

.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 1.25rem 0 0.5rem;
  color: var(--text-primary);
}

.markdown-content :deep(h2) { font-size: 1.125rem; }
.markdown-content :deep(h3) { font-size: 1rem; }
.markdown-content :deep(h4) { font-size: 0.9375rem; }

.markdown-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-content :deep(code) {
  padding: 0.125rem 0.375rem;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 0.875em;
  color: var(--primary);
}

.markdown-content :deep(pre) {
  padding: 1rem;
  background: var(--bg-dark);
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: none;
  color: var(--text-light);
}

.markdown-content :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}

.markdown-content :deep(li) {
  margin: 0.25rem 0;
}

.markdown-content :deep(a) {
  color: var(--primary);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1rem 0;
}

.markdown-content :deep(p) {
  margin: 0.5rem 0;
}

/* 质量评估 */
.quality-section {
  max-width: 800px;
  margin: 0 auto 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--bg-card);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.quality-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.quality-metrics {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.75rem;
}

.quality-metric {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--primary);
}

.quality-issues {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.issues-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
}

.quality-issues ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.quality-issues li {
  margin: 0.25rem 0;
}

/* 警告 */
.warnings-section {
  max-width: 800px;
  margin: 0 auto 1.5rem;
  padding: 0 1rem;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  font-size: 0.8125rem;
  color: #92400e;
  margin-bottom: 0.5rem;
}

.warning-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
}

/* 响应式 */
@media (max-width: 640px) {
  .report-header {
    padding: 0.625rem 1rem;
  }

  .header-title {
    font-size: 1rem;
  }

  .priority-stats {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .stat-card {
    padding: 0.75rem;
  }

  .extra-stats {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .normal-content,
  .emergency-content {
    padding: 1rem 0.75rem 6rem;
  }

  .priority-summary,
  .emergency-card {
    padding: 1.25rem;
    border-radius: 12px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
