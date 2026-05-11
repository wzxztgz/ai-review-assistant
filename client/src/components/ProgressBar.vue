<template>
  <div class="progress-bar-wrapper">
    <!-- 进度条 -->
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${percent}%` }"
      >
        <div class="progress-glow"></div>
      </div>
    </div>

    <!-- 阶段标签 -->
    <div v-if="stageLabel" class="progress-label">
      <span class="progress-percent">{{ Math.round(percent) }}%</span>
      <span class="progress-stage">{{ stageLabel }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  percent: {
    type: Number,
    default: 0,
  },
  stageLabel: {
    type: String,
    default: '',
  },
})
</script>

<style scoped>
.progress-bar-wrapper {
  width: 100%;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
  position: relative;
  min-width: 0;
}

.progress-glow {
  position: absolute;
  right: 0;
  top: -2px;
  bottom: -2px;
  width: 20px;
  background: radial-gradient(circle at right, rgba(59, 130, 246, 0.4), transparent);
  border-radius: 4px;
}

.progress-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.progress-percent {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--primary);
}

.progress-stage {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}
</style>
