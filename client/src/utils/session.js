/**
 * 会话管理工具
 * 使用 localStorage 持久化 sessionId
 */

const SESSION_KEY = 'ai_review_session_id'
const POINTS_KEY = 'ai_review_points'

/**
 * 获取或创建会话ID
 */
export function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY)
  
  if (!sessionId) {
    // 生成新的会话ID
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  
  return sessionId
}

/**
 * 获取用户积分（本地缓存）
 */
export function getLocalPoints() {
  const points = localStorage.getItem(POINTS_KEY)
  return points ? parseInt(points, 10) : 0
}

/**
 * 更新本地积分缓存
 */
export function setLocalPoints(points) {
  localStorage.setItem(POINTS_KEY, points.toString())
}

/**
 * 添加积分（更新本地缓存）
 */
export function addLocalPoints(amount) {
  const current = getLocalPoints()
  setLocalPoints(current + amount)
  return current + amount
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return {
    sessionId: getSessionId(),
    points: getLocalPoints(),
  }
}

/**
 * 重置会话（清空积分）
 */
export function resetSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(POINTS_KEY)
}
