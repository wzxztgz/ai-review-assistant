<template>
  <span :class="['priority-tag', `priority-${level}`]">
    <span class="priority-fires">{{ fireEmoji }}</span>
    <span class="priority-label" v-if="showLabel">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 优先级等级: 'high' | 'medium' | 'low' */
  level: {
    type: String,
    default: 'low',
    validator: (v) => ['high', 'medium', 'low'].includes(v),
  },
  /** 是否显示文字标签 */
  showLabel: {
    type: Boolean,
    default: false,
  },
})

const fireEmoji = computed(() => {
  const map = {
    high: '\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25',
    medium: '\uD83D\uDD25\uD83D\uDD25',
    low: '\uD83D\uDD25',
  }
  return map[props.level] || '\uD83D\uDD25'
})

const label = computed(() => {
  const map = {
    high: '高频必考',
    medium: '中频重要',
    low: '低频复习',
  }
  return map[props.level] || '未知'
})
</script>

<style scoped>
.priority-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.4;
}

.priority-high {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.priority-medium {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.priority-low {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.priority-fires {
  font-size: 0.6875rem;
  line-height: 1;
}

.priority-label {
  font-size: 0.6875rem;
}
</style>
