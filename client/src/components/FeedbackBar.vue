<template>
  <div class="feedback-bar">
    <!-- 关闭按钮 -->
    <button class="close-btn" @click="$emit('close')" title="关闭">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    
    <div class="feedback-question">这份复习报告对你有帮助吗？</div>

    <!-- 反馈按钮 -->
    <div class="feedback-buttons">
      <button
        v-for="option in feedbackOptions"
        :key="option.value"
        :class="['feedback-btn', { active: selectedRating === option.value, [option.class]: true }]"
        @click="handleSelect(option.value)"
        :disabled="isSubmitting"
      >
        <span class="feedback-emoji">{{ option.icon }}</span>
        <span class="feedback-label">{{ option.label }}</span>
      </button>
    </div>

    <!-- "没用"展开原因选择 -->
    <Transition name="slide">
      <div v-if="showReasons" class="reasons-section">
        <p class="reasons-title">请告诉我们原因（可多选）：</p>
        <div class="reasons-list">
          <label
            v-for="reason in reasonOptions"
            :key="reason.value"
            class="reason-item"
          >
            <input
              type="checkbox"
              :value="reason.value"
              v-model="selectedReasons"
              class="reason-checkbox"
            />
            <span class="reason-text">{{ reason.label }}</span>
          </label>
        </div>

        <!-- 自定义输入 -->
        <textarea
          v-model="customComment"
          class="comment-input"
          placeholder="其他建议或反馈（可选）"
          rows="2"
        ></textarea>

        <button
          class="btn-submit"
          @click="handleSubmit"
          :disabled="isSubmitting || (!selectedReasons.length && !customComment.trim())"
        >
          {{ isSubmitting ? '提交中...' : '提交反馈' }}
        </button>
      </div>
    </Transition>

    <!-- 成功提示 -->
    <Transition name="fade">
      <div v-if="submitted" class="success-message">
        <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>感谢你的反馈！我们会持续改进</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { submitFeedback } from '../api'

const props = defineProps({
  analysisId: {
    type: String,
    default: null,
  },
})

const feedbackOptions = [
  { value: 5, label: '有用', icon: '\uD83D\uDC4D', class: 'btn-good' },
  { value: 3, label: '一般', icon: '\uD83D\uDE10', class: 'btn-ok' },
  { value: 1, label: '没用', icon: '\uD83D\uDC4E', class: 'btn-bad' },
]

const reasonOptions = [
  { value: 'inaccurate', label: '知识点不准确' },
  { value: 'incomplete', label: '内容不够全面' },
  { value: 'unorganized', label: '结构不清晰' },
  { value: 'not_helpful', label: '对我的复习没有帮助' },
  { value: 'too_long', label: '内容太长，抓不住重点' },
]

const selectedRating = ref(null)
const showReasons = ref(false)
const selectedReasons = ref([])
const customComment = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)

function handleSelect(rating) {
  if (submitted.value) return

  selectedRating.value = rating

  // 选"没用"时展开原因选择
  if (rating === 1) {
    showReasons.value = true
  } else {
    showReasons.value = false
    // 直接提交
    submitQuickFeedback(rating)
  }
}

async function submitQuickFeedback(rating) {
  isSubmitting.value = true
  try {
    const categoryMap = { 5: 'usefulness', 3: 'usefulness', 1: 'other' }
    await submitFeedback({
      analysisId: props.analysisId,
      rating,
      category: categoryMap[rating] || 'other',
    })
    submitted.value = true
  } catch (err) {
    console.error('提交反馈失败:', err)
  } finally {
    isSubmitting.value = false
  }
}

async function handleSubmit() {
  if (isSubmitting.value) return

  isSubmitting.value = true
  try {
    const comment = [
      ...selectedReasons.value.map((r) => {
        const found = reasonOptions.find((opt) => opt.value === r)
        return found?.label || r
      }),
      customComment.value.trim(),
    ].filter(Boolean).join('；')

    await submitFeedback({
      analysisId: props.analysisId,
      rating: 1,
      category: 'other',
      comment,
    })
    submitted.value = true
  } catch (err) {
    console.error('提交反馈失败:', err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.feedback-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-color);
  padding: 1rem 1.25rem;
  z-index: 200;
  transition: all 0.3s ease;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

.feedback-question {
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

/* 反馈按钮 */
.feedback-buttons {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.feedback-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.feedback-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.feedback-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-btn.active.btn-good {
  border-color: var(--success);
  background: #f0fdf4;
  color: var(--success);
}

.feedback-btn.active.btn-ok {
  border-color: var(--warning);
  background: #fffbeb;
  color: var(--warning-dark);
}

.feedback-btn.active.btn-bad {
  border-color: var(--danger);
  background: #fef2f2;
  color: var(--danger);
}

.feedback-emoji {
  font-size: 1.125rem;
  line-height: 1;
}

.feedback-label {
  font-weight: 500;
}

/* 原因选择 */
.reasons-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.reasons-title {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin: 0 0 0.625rem;
}

.reasons-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.reason-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  cursor: pointer;
}

.reason-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}

.reason-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.comment-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  box-sizing: border-box;
}

.comment-input:focus {
  border-color: var(--primary);
}

.comment-input::placeholder {
  color: var(--text-tertiary);
}

.btn-submit {
  display: block;
  margin: 0.75rem auto 0;
  padding: 0.5rem 1.5rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 成功提示 */
.success-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  color: var(--success);
  font-size: 0.875rem;
  font-weight: 500;
}

.success-icon {
  width: 20px;
  height: 20px;
}

/* 动画 */
.slide-enter-active {
  transition: all 0.3s ease;
}

.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
  max-height: 0;
  padding-top: 0;
  margin-top: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .feedback-bar {
    padding: 0.75rem 1rem;
  }

  .feedback-btn {
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
  }

  .feedback-emoji {
    font-size: 1rem;
  }
}
</style>
