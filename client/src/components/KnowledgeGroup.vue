<template>
  <div class="knowledge-group" :class="{ expanded: isExpanded }">
    <!-- 组头部（可点击展开/折叠） -->
    <div class="group-header" @click="toggleExpand">
      <div class="group-header-left">
        <div class="expand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div class="group-title-area">
          <h3 class="group-title">{{ section.title || '未命名章节' }}</h3>
          <div class="group-meta">
            <PriorityTag
              v-if="sectionPriority"
              :level="sectionPriority"
              :show-label="false"
            />
            <span v-if="pointCount" class="meta-item">
              {{ pointCount }} 个知识点
            </span>
          </div>
        </div>
      </div>

      <div class="group-header-right">
        <span v-if="section.examFrequency" class="exam-freq-badge">
          {{ examFreqLabel }}
        </span>
        <span v-if="totalScore" class="score-badge">
          {{ totalScore }}分
        </span>
        <span v-if="examCount" class="count-badge">
          考 {{ examCount }} 次
        </span>
      </div>
    </div>

    <!-- 展开内容 -->
    <Transition name="expand">
      <div v-if="isExpanded" class="group-body">
        <div class="knowledge-points">
          <KnowledgePoint
            v-for="point in section.knowledgePoints"
            :key="point.id || point.name"
            :point="point"
          />
        </div>

        <!-- 无知识点提示 -->
        <div v-if="!section.knowledgePoints?.length" class="empty-points">
          暂无详细知识点
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PriorityTag from './PriorityTag.vue'
import KnowledgePoint from './KnowledgePoint.vue'

const props = defineProps({
  section: {
    type: Object,
    required: true,
  },
})

const isExpanded = ref(false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

// 推断组的优先级（取知识点中最高的）
const sectionPriority = computed(() => {
  const points = props.section.knowledgePoints || []
  if (!points.length) return null

  const priorities = ['high', 'medium', 'low']
  const freqMap = { high: 'high', medium: 'medium', low: 'low' }

  let highest = 'low'
  for (const p of points) {
    const freq = freqMap[p.examFrequency] || 'low'
    if (priorities.indexOf(freq) < priorities.indexOf(highest)) {
      highest = freq
    }
  }
  return highest
})

const pointCount = computed(() => props.section.knowledgePoints?.length || 0)

const totalScore = computed(() => props.section.totalScore || null)

const examCount = computed(() => props.section.examCount || null)

const examFreqLabel = computed(() => {
  const map = { high: '高频', medium: '中频', low: '低频' }
  return map[props.section.examFrequency] || ''
})
</script>

<style scoped>
.knowledge-group {
  background: var(--bg-card);
  border-radius: 14px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.knowledge-group:hover {
  box-shadow: var(--shadow-sm);
}

.knowledge-group.expanded {
  box-shadow: var(--shadow-md);
}

/* 头部 */
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
  gap: 1rem;
}

.group-header:hover {
  background: var(--bg-secondary);
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}

.expand-icon svg {
  width: 100%;
  height: 100%;
}

.expanded .expand-icon {
  transform: rotate(90deg);
}

.group-title-area {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.group-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 头部右侧 */
.group-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.exam-freq-badge {
  padding: 0.1875rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--primary-lightest);
  color: var(--primary);
}

.score-badge {
  padding: 0.1875rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: #f0fdf4;
  color: #16a34a;
}

.count-badge {
  padding: 0.1875rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

/* 展开内容 */
.group-body {
  padding: 0 1.25rem 1rem;
  border-top: 1px solid var(--border-color);
}

.knowledge-points {
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-points {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

/* 展开/折叠动画 */
.expand-enter-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 2000px;
}

/* 响应式 */
@media (max-width: 640px) {
  .group-header {
    padding: 0.875rem 1rem;
  }

  .group-header-right {
    display: none;
  }

  .group-body {
    padding: 0 1rem 0.875rem;
  }
}
</style>
