<template>
  <div class="analyzing-page">
    <div class="analyzing-container">
      <!-- 动画区域 -->
      <div class="animation-area">
        <div class="pulse-ring"></div>
        <div class="pulse-ring delay-1"></div>
        <div class="pulse-ring delay-2"></div>
        <div class="center-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" stroke="var(--primary)" stroke-width="2" opacity="0.2" />
            <path d="M16 32V18l8 5 8-5v14" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <animate attributeName="stroke-dasharray" values="0,100;50,100;0,100" dur="2s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>
      </div>

      <!-- 标题 -->
      <h1 class="analyzing-title">AI 正在分析你的资料</h1>
      <p class="analyzing-subtitle">请耐心等待，这可能需要 1-3 分钟</p>

      <!-- 进度条 -->
      <ProgressBar
        :percent="store.progress.percent"
        :stage-label="store.progress.message"
      />

      <!-- 步骤列表 -->
      <div class="steps-list">
        <div
          v-for="(step, index) in steps"
          :key="step.name"
          :class="['step-item', getStepStatus(step.name)]"
        >
          <div class="step-indicator">
            <div class="step-circle">
              <template v-if="getStepStatus(step.name) === 'completed'">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </template>
              <template v-else-if="getStepStatus(step.name) === 'active'">
                <span class="step-spinner"></span>
              </template>
              <template v-else>
                {{ index + 1 }}
              </template>
            </div>
            <div v-if="index < steps.length - 1" class="step-line"></div>
          </div>
          <div class="step-content">
            <span class="step-name">{{ step.label }}</span>
            <span class="step-desc">{{ step.desc }}</span>
          </div>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="store.error" class="error-banner">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span>{{ store.error }}</span>
        <button class="btn-retry" @click="handleRetry">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalysisStore } from '../stores/analysis'
import { startAnalysisStream, startAnalysis } from '../api'
import ProgressBar from '../components/ProgressBar.vue'

const router = useRouter()
const store = useAnalysisStore()

const steps = [
  { name: 'extract', label: '正在解析PDF...', desc: '提取文本内容，识别扫描件' },
  { name: 'detect', label: '正在识别资料类型...', desc: '判断是真题、PPT还是笔记' },
  { name: 'analyze', label: 'AI正在分析知识点...', desc: 'DeepSeek提取考点、梳理优先级' },
  { name: 'assemble', label: '正在生成复习文档...', desc: '整理章节结构、标注重点' },
  { name: 'metadata', label: '正在完成报告...', desc: '添加题型统计、质量评估' },
]

const currentStepIndex = computed(() => {
  const stage = store.progress.stage
  const idx = steps.findIndex((s) => s.name === stage)
  return idx >= 0 ? idx : -1
})

function getStepStatus(stepName) {
  const idx = steps.findIndex((s) => s.name === stepName)
  const currentIdx = currentStepIndex.value

  if (store.status === 'done') return 'completed'
  if (store.status === 'error') {
    return idx < currentIdx ? 'completed' : idx === currentIdx ? 'error' : 'pending'
  }
  if (idx < currentIdx) return 'completed'
  if (idx === currentIdx) return 'active'
  return 'pending'
}

let abortController = null

async function runAnalysis() {
  store.setError(null)
  store.setProgress('extract', '正在提取文档内容...', 0)

  try {
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
        priorityMode: store.config.targetGrade === 'pass' && store.config.remainingDays <= 7
          ? 'emergency'
          : 'normal',
        detailLevel: store.config.detailLevel,
        targetGrade: store.config.targetGrade,
        remainingDays: store.config.remainingDays,
        ocrMode: store.config.ocrMode || 'fast',
      },
    }

    // 尝试使用流式接口
    try {
      const result = await startAnalysisStream(params, (stage, message, progress) => {
        store.setProgress(stage, message, progress)
      })

      store.setResult(result)

      // 延迟跳转，让用户看到完成状态
      setTimeout(() => {
        router.push(`/report/${store.analysisId}`)
      }, 800)
    } catch (streamErr) {
      // 流式失败，回退到非流式
      if (streamErr.code === 'STREAM_ERROR') {
        store.setProgress('analyze', '正在分析（非流式模式）...', 40)
        const result = await startAnalysis(params)
        store.setProgress('metadata', '生成报告...', 90)
        store.setResult(result)

        setTimeout(() => {
          router.push(`/report/${store.analysisId}`)
        }, 800)
      } else {
        throw streamErr
      }
    }
  } catch (err) {
    console.error('分析失败:', err)
    store.setError(err.message || '分析过程中发生错误，请重试')
  }
}

function handleRetry() {
  store.setStatus('analyzing')
  runAnalysis()
}

onMounted(() => {
  console.log('[Analyzing] store.config:', store.config)
  console.log('[Analyzing] ocrMode:', store.config.ocrMode)

  if (store.status !== 'analyzing') {
    store.setStatus('analyzing')
  }
  runAnalysis()
})

onUnmounted(() => {
  // 如果离开页面，清理状态（但不中断分析）
})
</script>

<style scoped>
.analyzing-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  padding: 2rem 1rem;
}

.analyzing-container {
  max-width: 480px;
  width: 100%;
  text-align: center;
}

/* 动画区域 */
.animation-area {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 2rem;
}

.pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--primary);
  opacity: 0;
  animation: pulse 2s ease-out infinite;
}

.pulse-ring.delay-1 {
  animation-delay: 0.5s;
}

.pulse-ring.delay-2 {
  animation-delay: 1s;
}

.center-icon {
  position: absolute;
  inset: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.center-icon svg {
  width: 100%;
  height: 100%;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* 标题 */
.analyzing-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.analyzing-subtitle {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin: 0 0 2rem;
}

/* 步骤列表 */
.steps-list {
  text-align: left;
  margin-top: 2rem;
}

.step-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 0.5rem 0;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 2px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-tertiary);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.step-item.active .step-circle {
  border-color: var(--primary);
  background: var(--primary-lightest);
  color: var(--primary);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.step-item.completed .step-circle {
  border-color: var(--success);
  background: var(--success-lightest);
  color: var(--success);
}

.step-item.error .step-circle {
  border-color: var(--danger);
  background: var(--danger-lightest);
  color: var(--danger);
}

.step-circle svg {
  width: 16px;
  height: 16px;
}

.step-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.step-line {
  width: 2px;
  height: 20px;
  background: var(--border-color);
  margin: 4px 0;
  transition: background 0.3s;
}

.step-item.completed .step-line {
  background: var(--success);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-top: 4px;
}

.step-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.3s;
}

.step-item.active .step-name {
  color: var(--primary);
}

.step-item.completed .step-name {
  color: var(--success);
}

.step-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 错误提示 */
.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  background: var(--danger-lightest);
  border: 1px solid var(--danger-light);
  border-radius: 12px;
  text-align: left;
  color: var(--danger);
  font-size: 0.875rem;
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-retry {
  margin-left: auto;
  padding: 0.375rem 1rem;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.btn-retry:hover {
  opacity: 0.9;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 640px) {
  .analyzing-title {
    font-size: 1.25rem;
  }

  .animation-area {
    width: 100px;
    height: 100px;
    margin-bottom: 1.5rem;
  }

  .center-icon {
    inset: 16px;
  }
}
</style>
