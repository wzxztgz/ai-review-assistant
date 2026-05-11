<template>
  <div class="file-upload">
    <!-- 拖拽上传区域 -->
    <div
      :class="['drop-zone', { 'drag-over': isDragOver, 'has-files': store.hasFiles }]"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".pdf,.txt,.doc,.docx"
        class="file-input"
        @change="handleFileSelect"
      />

      <div class="drop-zone-content">
        <div class="upload-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" stroke-width="2" fill="none" />
            <path d="M4 16h40" stroke="currentColor" stroke-width="2" />
            <path d="M14 16v20" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" />
            <path d="M24 24v8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            <path d="M20 28l4-4 4 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <p class="drop-text">
          <span class="drop-text-main">拖拽文件到此处，或点击选择</span>
          <span class="drop-text-sub">支持 PDF、TXT、DOCX 格式，单个文件最大 50MB，最多 10 个</span>
        </p>
      </div>
    </div>

    <!-- 上传错误提示 -->
    <div v-if="uploadError" class="upload-error">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ uploadError }}</span>
    </div>

    <!-- 已上传文件列表 -->
    <div v-if="store.hasFiles" class="file-list">
      <div class="file-list-header">
        <span class="file-list-title">已上传文件 ({{ store.files.length }})</span>
        <button class="btn-clear-all" @click="clearAllFiles">清空全部</button>
      </div>

      <TransitionGroup name="file-item" tag="div" class="file-items">
        <div
          v-for="file in store.files"
          :key="file.id"
          class="file-item"
        >
          <div class="file-icon">
            <svg v-if="isPDF(file)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>

          <div class="file-info">
            <span class="file-name" :title="file.originalName">{{ file.originalName }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
          </div>

          <!-- 类型选择 -->
          <select
            :value="file.type"
            class="file-type-select"
            @change="handleTypeChange(file.id, $event.target.value)"
          >
            <option value="unknown">自动识别</option>
            <option value="ppt">PPT 课件</option>
            <option value="exam">真题试卷</option>
            <option value="notes">课堂笔记</option>
          </select>

          <!-- 删除按钮 -->
          <button
            class="btn-delete"
            @click="handleDelete(file)"
            title="删除文件"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAnalysisStore } from '../stores/analysis'
import { uploadFiles, deleteFile } from '../api'

const store = useAnalysisStore()
const fileInputRef = ref(null)
const isDragOver = ref(false)
const uploadError = ref('')
const isUploading = ref(false)

const MAX_FILES = 10
const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.doc', '.docx']

function isPDF(file) {
  return file.originalName?.toLowerCase().endsWith('.pdf') || file.mimeType === 'application/pdf'
}

function formatSize(bytes) {
  if (!bytes) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleDragEnter(e) {
  isDragOver.value = true
}

function handleDragOver(e) {
  isDragOver.value = true
}

function handleDragLeave(e) {
  isDragOver.value = false
}

async function handleDrop(e) {
  isDragOver.value = false
  uploadError.value = ''

  const droppedFiles = Array.from(e.dataTransfer.files)
  await processFiles(droppedFiles)
}

async function handleFileSelect(e) {
  uploadError.value = ''
  const selectedFiles = Array.from(e.target.files)
  await processFiles(selectedFiles)

  // 重置 input，允许重复选择同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function processFiles(files) {
  // 检查是否有 .doc 文件（旧格式不支持）
  const docFiles = files.filter((f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    return ext === '.doc'
  })
  
  if (docFiles.length > 0) {
    uploadError.value = `暂不支持 .doc 格式，请将 ${docFiles.map(f => f.name).join('、')} 另存为 .docx 格式后上传`
    return
  }

  // 过滤不支持的文件类型
  const validFiles = files.filter((f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    return ALLOWED_EXTENSIONS.includes(ext)
  })

  if (validFiles.length === 0) {
    uploadError.value = '不支持的文件类型，请上传 PDF、TXT 或 DOCX 文件'
    return
  }

  if (validFiles.length !== files.length) {
    uploadError.value = `已过滤 ${files.length - validFiles.length} 个不支持的文件`
  }

  // 检查文件数量
  if (store.files.length + validFiles.length > MAX_FILES) {
    uploadError.value = `最多上传 ${MAX_FILES} 个文件，当前已有 ${store.files.length} 个`
    return
  }

  // 检查文件大小
  const oversized = validFiles.filter((f) => f.size > MAX_SIZE)
  if (oversized.length > 0) {
    uploadError.value = `${oversized.map((f) => f.name).join('、')} 超过 50MB 限制`
    return
  }

  // 上传文件
  isUploading.value = true
  try {
    const result = await uploadFiles(validFiles)
    store.addFiles(result.files)
  } catch (err) {
    uploadError.value = err.message || '文件上传失败'
  } finally {
    isUploading.value = false
  }
}

function handleTypeChange(fileId, type) {
  store.updateFileType(fileId, type)
}

async function handleDelete(file) {
  try {
    if (file.savedName) {
      await deleteFile(file.savedName)
    }
  } catch (err) {
    // 即使删除失败也从列表移除
    console.warn('删除文件失败:', err)
  }
  store.removeFile(file.id)
}

function clearAllFiles() {
  store.files = []
  uploadError.value = ''
}
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* 拖拽区域 */
.drop-zone {
  position: relative;
  border: 2px dashed var(--border-color);
  border-radius: 14px;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-secondary);
}

.drop-zone:hover {
  border-color: var(--primary-light);
  background: var(--primary-lightest);
}

.drop-zone.drag-over {
  border-color: var(--primary);
  background: var(--primary-lightest);
  transform: scale(1.01);
}

.drop-zone.has-files {
  padding: 1.25rem 1rem;
}

.file-input {
  display: none;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--primary);
  opacity: 0.7;
}

.upload-icon svg {
  width: 100%;
  height: 100%;
}

.drop-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.drop-text-main {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.drop-text-sub {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 上传错误 */
.upload-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--danger-lightest);
  border: 1px solid var(--danger-light);
  border-radius: 10px;
  font-size: 0.8125rem;
  color: var(--danger);
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* 文件列表 */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-list-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-tertiary);
}

.btn-clear-all {
  font-size: 0.8125rem;
  color: var(--danger);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-clear-all:hover {
  background: var(--danger-lightest);
}

/* 文件项 */
.file-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.file-item:hover {
  border-color: var(--primary-light);
}

.file-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  flex-shrink: 0;
}

.file-icon svg {
  width: 28px;
  height: 28px;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.file-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* 类型选择 */
.file-type-select {
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  background: var(--bg-card);
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
  flex-shrink: 0;
}

.file-type-select:focus {
  border-color: var(--primary);
}

/* 删除按钮 */
.btn-delete {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-delete:hover {
  background: var(--danger-lightest);
  color: var(--danger);
}

.btn-delete svg {
  width: 16px;
  height: 16px;
}

/* 列表动画 */
.file-item-enter-active {
  transition: all 0.3s ease;
}

.file-item-leave-active {
  transition: all 0.2s ease;
}

.file-item-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.file-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 响应式 */
@media (max-width: 640px) {
  .drop-zone {
    padding: 1.5rem 1rem;
  }

  .upload-icon {
    width: 40px;
    height: 40px;
  }

  .file-item {
    padding: 0.625rem;
    gap: 0.5rem;
  }

  .file-icon {
    width: 32px;
    height: 32px;
  }

  .file-icon svg {
    width: 24px;
    height: 24px;
  }

  .file-type-select {
    padding: 0.25rem 0.375rem;
    font-size: 0.75rem;
  }
}
</style>
