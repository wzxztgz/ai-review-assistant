/**
 * API 封装模块
 * 与后端 API 通信
 */

import { getSessionId } from '../utils/session'

// 根据环境配置 API 地址
const API_BASE = import.meta.env.VITE_API_URL || '/api'
const BASE_URL = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`

/**
 * 通用请求封装
 */
async function request(url, options = {}) {
  const { method = 'GET', body = null, headers = {} } = options

  const config = {
    method,
    headers: {
      ...headers,
      'X-Session-Id': getSessionId(), // 添加会话ID
    },
  }

  // 非GET请求且body不为FormData时，设置Content-Type
  if (body && !(body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
    config.body = JSON.stringify(body)
  } else if (body instanceof FormData) {
    // FormData 由浏览器自动设置 Content-Type（含 boundary）
    config.body = body
  }

  const response = await fetch(`${BASE_URL}${url}`, config)

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.error?.message || '请求失败')
    error.code = data.error?.code || 'UNKNOWN_ERROR'
    error.status = response.status
    throw error
  }

  return data
}

/**
 * 上传文件
 * @param {File[]} files - 要上传的文件数组
 * @returns {Promise<{files: Array, totalFiles: number, totalSize: number}>}
 */
export async function uploadFiles(files) {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })

  const res = await request('/upload', {
    method: 'POST',
    body: formData,
  })

  return res.data
}

/**
 * 删除已上传的文件
 * @param {string} fileName - 服务器上的文件名
 */
export async function deleteFile(fileName) {
  const res = await request(`/upload/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  })
  return res.data
}

/**
 * 开始AI分析（非流式）
 * @param {{files: Array, config: object}} params
 * @returns {Promise<object>} 分析结果
 */
export async function startAnalysis(params) {
  const res = await request('/analyze', {
    method: 'POST',
    body: params,
  })
  return res.data
}

/**
 * 开始AI分析（流式 SSE）
 * @param {{files: Array, config: object}} params
 * @param {function} onProgress - 进度回调 (stage, message, progress)
 * @returns {Promise<object>} 分析结果
 */
export async function startAnalysisStream(params, onProgress) {
  const response = await fetch(`${BASE_URL}/analyze/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.error?.message || '流式分析请求失败')
    error.code = errorData.error?.code || 'STREAM_ERROR'
    throw error
  }

  return new Promise((resolve, reject) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    function processChunk(chunk) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim()
          continue
        }

        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue

          try {
            const data = JSON.parse(dataStr)

            // 根据事件类型处理
            if (data.stage || data.message) {
              // progress 事件
              onProgress?.(data.stage, data.message, data.progress)
            } else if (data.success !== undefined) {
              // result 事件
              if (data.success) {
                resolve(data.data)
              } else {
                reject(new Error(data.message || '分析失败'))
              }
            } else if (data.code) {
              // error 事件
              reject(new Error(data.message || '分析过程中发生错误'))
            }
          } catch (e) {
            // JSON 解析失败，忽略
          }
        }
      }
    }

    function read() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            // 流结束但未收到result事件
            reject(new Error('分析流意外结束'))
            return
          }
          processChunk(decoder.decode(value, { stream: true }))
          read()
        })
        .catch(reject)
    }

    read()
  })
}

/**
 * 获取分析结果（用于刷新/恢复报告页）
 * 注意：当前后端没有单独的获取结果接口，结果通过分析接口直接返回
 * 此方法保留用于未来扩展
 */
export async function getAnalysisResult(id) {
  // 未来可扩展：GET /api/analyze/:id
  // 当前返回null，表示需要重新分析
  return null
}

/**
 * 提交用户反馈
 * @param {{analysisId?: string, rating: number, category: string, comment?: string, suggestions?: string, fileInfo?: object}} params
 */
export async function submitFeedback(params) {
  const res = await request('/feedback', {
    method: 'POST',
    body: params,
  })
  return res.data
}

/**
 * 导出分析报告
 * @param {{result: object, format: 'pdf' | 'docx' | 'markdown'}} params
 * @returns {Promise<Blob>} 文件Blob
 */
export async function exportReport(params) {
  const response = await fetch(`${BASE_URL}/analyze/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const error = new Error(errorData.error?.message || '导出失败')
    error.code = errorData.error?.code || 'EXPORT_ERROR'
    throw error
  }

  return response.blob()
}

/**
 * 提交真题共享授权
 * @param {{analysisId: string, consent: boolean, fileIds: string[]}} params
 */
export async function submitExamConsent(params) {
  const res = await request('/exam/consent', {
    method: 'POST',
    body: params,
  })
  
  // 更新本地积分缓存
  if (res.data?.points) {
    const { addLocalPoints } = await import('../utils/session')
    addLocalPoints(res.data.points)
  }
  
  return res.data
}

/**
 * 获取用户积分
 */
export async function getUserPoints() {
  const res = await request('/exam/points')
  return res.data
}

/**
 * 获取真题列表
 */
export async function getExamList(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await request(`/exam/list${query ? '?' + query : ''}`)
  return res.data
}

/**
 * 获取真题题目详情
 */
export async function getExamQuestions(examId) {
  const res = await request(`/exam/${examId}/questions`)
  return res.data
}

/**
 * 解锁真题
 */
export async function unlockExam(examId) {
  const res = await request(`/exam/unlock/${examId}`, {
    method: 'POST',
  })
  return res.data
}

/**
 * 健康检查
 */
export async function healthCheck() {
  const res = await request('/health')
  return res
}
