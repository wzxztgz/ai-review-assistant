import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAnalysisStore = defineStore('analysis', () => {
  // ============================================
  // 状态
  // ============================================

  /** 已上传的文件列表 */
  const files = ref([])

  /** 分析配置 */
  const config = ref({
    courseName: '',
    examDate: '',
    priorityMode: 'normal', // 'normal' | 'emergency'
    detailLevel: 'normal',  // 'concise' | 'normal' | 'detailed'
    targetGrade: 'pass',    // 'pass' | 'good' | 'excellent'
    remainingDays: 30,
    customPrompt: '',
    ocrMode: 'slow',        // 'slow'(Tesseract) | 'fast'(百度云OCR)
  })

  /** 分析结果 */
  const analysisResult = ref(null)

  /** 分析进度 */
  const progress = ref({
    stage: '',
    message: '',
    percent: 0,
  })

  /** 分析状态: idle | uploading | analyzing | done | error */
  const status = ref('idle')

  /** 错误信息 */
  const error = ref(null)

  /** 当前查看模式: normal | emergency */
  const viewMode = ref('normal')

  /** 分析ID（用于报告页标识） */
  const analysisId = ref(null)

  // ============================================
  // 计算属性
  // ============================================

  /** 是否正在处理中 */
  const isProcessing = computed(() => ['uploading', 'analyzing'].includes(status.value))

  /** 是否有已上传的文件 */
  const hasFiles = computed(() => files.value.length > 0)

  /** 文件总大小（格式化） */
  const totalFileSize = computed(() => {
    const bytes = files.value.reduce((sum, f) => sum + (f.size || 0), 0)
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  })

  /** 当前显示的文档 */
  const currentDocument = computed(() => {
    if (!analysisResult.value) return null
    if (viewMode.value === 'emergency') {
      return analysisResult.value.emergencyDocument
    }
    return analysisResult.value.fullDocument
  })

  /** 优先级报告 */
  const priorityReport = computed(() => {
    return analysisResult.value?.priorityReport || null
  })

  /** 元数据 */
  const metadata = computed(() => {
    return analysisResult.value?.metadata || null
  })

  // ============================================
  // 方法
  // ============================================

  /**
   * 基于文件名检测是否为真题
   */
  function detectExamByFileName(fileName) {
    if (!fileName) return false
    const name = fileName.toLowerCase()
    const examPatterns = [
      '真题', '试卷', '期末', '期中', '考试', '试题',
      'exam', 'test', 'quiz', 'final', 'midterm',
      '2021', '2022', '2023', '2024', '2025', // 年份
    ]
    return examPatterns.some(pattern => name.includes(pattern))
  }

  /**
   * 添加文件到列表
   * @param {object} fileInfo - { id, originalName, savedName, path, size, mimeType, type }
   */
  function addFile(fileInfo) {
    // 自动检测是否为真题（基于文件名）
    const detectedType = fileInfo.type || 'unknown'
    const isExam = detectedType === 'exam' || detectExamByFileName(fileInfo.originalName)
    
    files.value.push({
      ...fileInfo,
      type: isExam ? 'exam' : detectedType, // 覆盖为 exam
      uploadProgress: 100,
    })
  }

  /**
   * 批量添加文件
   */
  function addFiles(fileInfos) {
    fileInfos.forEach((info) => addFile(info))
  }

  /**
   * 移除文件
   */
  function removeFile(fileId) {
    const index = files.value.findIndex((f) => f.id === fileId)
    if (index !== -1) {
      files.value.splice(index, 1)
    }
  }

  /**
   * 更新文件类型
   */
  function updateFileType(fileId, type) {
    const index = files.value.findIndex((f) => f.id === fileId)
    if (index !== -1) {
      // 使用 splice 确保响应式更新
      files.value[index] = { ...files.value[index], type }
    }
  }

  /**
   * 设置分析配置
   */
  function setConfig(key, value) {
    config.value[key] = value
  }

  /**
   * 设置进度
   */
  function setProgress(stage, message, percent) {
    progress.value = { stage, message, percent }
  }

  /**
   * 设置分析结果
   */
  function setResult(result) {
    analysisResult.value = result
    status.value = 'done'
    analysisId.value = `report_${Date.now()}`
  }

  /**
   * 设置状态
   */
  function setStatus(newStatus) {
    status.value = newStatus
  }

  /**
   * 设置错误
   */
  function setError(err) {
    error.value = err
    status.value = 'error'
  }

  /**
   * 切换查看模式
   */
  function toggleViewMode() {
    viewMode.value = viewMode.value === 'normal' ? 'emergency' : 'normal'
  }

  /**
   * 重置所有状态
   */
  function reset() {
    files.value = []
    analysisResult.value = null
    progress.value = { stage: '', message: '', percent: 0 }
    status.value = 'idle'
    error.value = null
    viewMode.value = 'normal'
    analysisId.value = null
  }

  return {
    // 状态
    files,
    config,
    analysisResult,
    progress,
    status,
    error,
    viewMode,
    analysisId,
    // 计算属性
    isProcessing,
    hasFiles,
    totalFileSize,
    currentDocument,
    priorityReport,
    metadata,
    // 方法
    addFile,
    addFiles,
    removeFile,
    updateFileType,
    setConfig,
    setProgress,
    setResult,
    setStatus,
    setError,
    toggleViewMode,
    reset,
  }
})
