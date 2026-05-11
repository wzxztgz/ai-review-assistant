<template>
  <div class="knowledge-point">
    <!-- 知识点头部 -->
    <div class="point-header">
      <div class="point-header-left">
        <h4 class="point-name">{{ point.name || '未命名知识点' }}</h4>
        <span v-if="point.examInfo?.frequency" class="freq-badge" :class="`freq-${point.examInfo.frequency}`">
          {{ freqLabel }}
        </span>
      </div>
    </div>

    <!-- 详细内容 -->
    <div class="point-body">
      <!-- 解释（Markdown渲染） -->
      <div v-if="point.explanation || point.content" class="point-section">
        <div class="point-explanation markdown-content" v-html="renderedExplanation"></div>
      </div>

      <!-- 公式和关键数字 -->
      <div v-if="point.formulas?.length" class="point-section formulas-section">
        <h5 class="point-section-title">公式 / 关键约束</h5>
        <div class="formulas-list">
          <code v-for="(formula, i) in point.formulas" :key="i" class="formula-item">{{ formula }}</code>
        </div>
      </div>

      <!-- 关键要点 -->
      <div v-if="point.keyPoints?.length" class="point-section">
        <h5 class="point-section-title">关键要点</h5>
        <ul class="key-points-list">
          <li v-for="(kp, i) in point.keyPoints" :key="i">{{ kp }}</li>
        </ul>
      </div>

      <!-- 考试信息卡片（仅有真题时） -->
      <div v-if="point.examInfo" class="point-section exam-info-card">
        <div class="exam-info-header">
          <h5 class="point-section-title exam-title">考试信息</h5>
          <span class="freq-badge" :class="`freq-${point.examInfo.frequency}`">{{ freqLabel }}</span>
        </div>

        <!-- 考法说明 -->
        <div v-if="point.examInfo.examMethod" class="exam-method">
          <span class="exam-method-label">考法：</span>
          <span class="exam-method-text">{{ point.examInfo.examMethod }}</span>
        </div>

        <!-- 真题列表 -->
        <div v-if="point.examInfo.questions?.length" class="exam-questions">
          <div v-for="(q, i) in point.examInfo.questions" :key="i" class="exam-question-item">
            <div class="eq-header">
              <span class="eq-type-badge">{{ q.type }}</span>
              <span v-if="q.score" class="eq-score">{{ q.score }}分</span>
              <span v-if="q.source" class="eq-source">{{ q.source }}</span>
            </div>
            <p class="eq-content">{{ q.question }}</p>
          </div>
        </div>
      </div>

      <!-- 示例 -->
      <div v-if="point.examples?.length" class="point-section">
        <h5 class="point-section-title">示例</h5>
        <div class="examples-list">
          <div v-for="(ex, i) in point.examples" :key="i" class="example-item">
            {{ ex }}
          </div>
        </div>
      </div>

      <!-- 关联知识点 -->
      <div v-if="point.connections?.length" class="point-section">
        <h5 class="point-section-title">关联知识点</h5>
        <div class="connections">
          <span v-for="conn in point.connections" :key="conn" class="connection-tag">
            {{ conn }}
          </span>
        </div>
      </div>

      <!-- 来源 -->
      <div v-if="point.source" class="point-section">
        <span class="source-tag">📍 {{ point.source }}</span>
      </div>
    </div>

    <!-- 提示/警告 -->
    <div v-if="point.tips?.length || point.warnings?.length" class="point-footer">
      <div v-if="point.tips?.length" class="tips-section">
        <h5 class="tips-title">💡 提示</h5>
        <ul class="tips-list">
          <li v-for="(tip, i) in point.tips" :key="i">{{ tip }}</li>
        </ul>
      </div>
      <div v-if="point.warnings?.length" class="warnings-section">
        <h5 class="warnings-title">⚠️ 注意</h5>
        <ul class="warnings-list">
          <li v-for="(warning, i) in point.warnings" :key="i">{{ warning }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  point: {
    type: Object,
    required: true,
  },
})

const freqLabel = computed(() => {
  const map = {
    '高频': '高频考点',
    '中频': '中频考点',
    '低频': '低频考点',
    '未考': '尚未考过',
  }
  return map[props.point.examInfo?.frequency] || props.point.examInfo?.frequency || ''
})

// 简单的 Markdown 渲染（支持表格、加粗、行内代码）
const renderedExplanation = computed(() => {
  const text = props.point.explanation || props.point.content || ''

  // 渲染 Markdown 表格
  let html = text.replace(
    /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+((?:\|.+\|[\r\n]*)+))/g,
    (match) => {
      const lines = match.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) return match

      const headerCells = lines[0].split('|').filter(c => c.trim())
      const bodyLines = lines.slice(2) // 跳过分隔行

      let table = '<table class="md-table"><thead><tr>'
      headerCells.forEach(cell => {
        table += `<th>${cell.trim()}</th>`
      })
      table += '</tr></thead><tbody>'

      bodyLines.forEach(line => {
        const cells = line.split('|').filter(c => c.trim())
        if (cells.length === 0) return
        table += '<tr>'
        cells.forEach(cell => {
          table += `<td>${cell.trim()}</td>`
        })
        table += '</tr>'
      })

      table += '</tbody></table>'
      return table
    }
  )

  // 加粗 **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 行内代码 `text`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // 换行
  html = html.replace(/\n/g, '<br>')

  return html
})
</script>

<style scoped>
.knowledge-point {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
  border-left: 3px solid var(--primary);
  transition: border-color 0.2s;
}

/* 头部 */
.point-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.625rem;
}

.point-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.point-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* 频率标签 */
.freq-badge {
  padding: 0.125rem 0.4375rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.freq-高频 {
  background: #fef2f2;
  color: #dc2626;
}

.freq-中频 {
  background: #fffbeb;
  color: #d97706;
}

.freq-低频 {
  background: #f0fdf4;
  color: #16a34a;
}

.freq-未考 {
  background: var(--bg-card);
  color: var(--text-tertiary);
}

/* 内容区 */
.point-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.point-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.point-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-tertiary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Markdown 渲染 */
.point-explanation {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}

.markdown-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.markdown-content :deep(.inline-code) {
  padding: 0.0625rem 0.375rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.8125rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--primary);
}

/* Markdown 表格 */
.markdown-content :deep(.md-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
  font-size: 0.8125rem;
}

.markdown-content :deep(.md-table th) {
  background: var(--bg-card);
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
  white-space: nowrap;
}

.markdown-content :deep(.md-table td) {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  line-height: 1.5;
}

.markdown-content :deep(.md-table tbody tr:hover) {
  background: var(--primary-lightest);
}

/* 公式区域 */
.formulas-section {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 0.625rem 0.75rem !important;
}

.formulas-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.formula-item {
  display: block;
  padding: 0.25rem 0.5rem;
  background: white;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #0369a1;
  border: 1px solid #e0f2fe;
}

/* 关键要点 */
.key-points-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.key-points-list li {
  position: relative;
  padding-left: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.key-points-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.5em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--primary);
}

/* 考试信息卡片 */
.exam-info-card {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.75rem !important;
}

.exam-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.exam-title {
  color: #92400e !important;
}

.exam-method {
  font-size: 0.8125rem;
  color: #78350f;
  line-height: 1.5;
  padding: 0.375rem 0;
}

.exam-method-label {
  font-weight: 600;
}

.exam-method-text {
  color: #92400e;
}

.exam-questions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.exam-question-item {
  background: white;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.5rem 0.625rem;
}

.eq-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.eq-type-badge {
  padding: 0.0625rem 0.375rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.eq-score {
  font-size: 0.75rem;
  color: #b45309;
  font-weight: 500;
}

.eq-source {
  font-size: 0.6875rem;
  color: #a16207;
  margin-left: auto;
}

.eq-content {
  font-size: 0.8125rem;
  color: #78350f;
  line-height: 1.5;
  margin: 0;
}

/* 示例 */
.examples-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.example-item {
  padding: 0.5rem 0.75rem;
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
  border: 1px solid var(--border-color);
}

/* 关联知识点 */
.connections {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.connection-tag {
  padding: 0.1875rem 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 来源 */
.source-tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--bg-card);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 提示/警告 */
.point-footer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tips-section,
.warnings-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tips-title,
.warnings-title {
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0;
}

.tips-title {
  color: #059669;
}

.warnings-title {
  color: #d97706;
}

.tips-list,
.warnings-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tips-list li,
.warnings-list li {
  font-size: 0.8125rem;
  padding-left: 1rem;
  position: relative;
  line-height: 1.5;
}

.tips-list li {
  color: #047857;
}

.warnings-list li {
  color: #92400e;
}

.tips-list li::before,
.warnings-list li::before {
  content: '•';
  position: absolute;
  left: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .knowledge-point {
    padding: 0.875rem;
  }

  .point-name {
    font-size: 0.875rem;
  }

  .point-explanation {
    font-size: 0.8125rem;
  }
}
</style>