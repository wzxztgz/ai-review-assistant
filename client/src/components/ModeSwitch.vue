<template>
  <div class="mode-switch">
    <button
      :class="['mode-btn', { active: modelValue === 'normal' }]"
      @click="$emit('update:modelValue', 'normal')"
    >
      <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <span>正常模式</span>
    </button>
    <button
      :class="['mode-btn emergency', { active: modelValue === 'emergency' }]"
      @click="$emit('update:modelValue', 'emergency')"
    >
      <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>急救模式</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'normal',
  },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.mode-switch {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 3px;
  border: 1px solid var(--border-color);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mode-btn:hover {
  color: var(--text-secondary);
}

.mode-btn.active {
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.mode-btn.emergency.active {
  background: #fef2f2;
  color: var(--danger);
}

.mode-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* 响应式 */
@media (max-width: 640px) {
  .mode-btn {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
  }

  .mode-btn span:last-child {
    display: none;
  }

  .mode-icon {
    width: 18px;
    height: 18px;
  }
}
</style>
