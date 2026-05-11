<template>
  <Teleport to="body">
    <div v-if="visible" class="consent-modal-overlay" @click.self="handleClose">
      <div class="consent-modal">
        <!-- 头部 -->
        <div class="modal-header">
          <div class="header-icon">📋</div>
          <h3 class="header-title">检测到真题/试卷</h3>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- 内容 -->
        <div class="modal-body">
          <p class="detected-info">
            我们检测到您上传了 <strong>{{ examFiles.length }} 个</strong> 包含往年考试题目的文件。
          </p>

          <!-- 价值说明 -->
          <div class="value-section">
            <h4 class="section-title">💡 如果您同意共享，我们可以：</h4>
            <ul class="value-list">
              <li>
                <span class="value-icon">📊</span>
                <span>为您<strong>标注考点考频</strong>，知道哪些是重点</span>
              </li>
              <li>
                <span class="value-icon">🔮</span>
                <span>基于往年题<strong>预测今年考点</strong></span>
              </li>
              <li>
                <span class="value-icon">🤝</span>
                <span>积累到真题库，<strong>帮助其他同学</strong>（完全匿名）</span>
              </li>
            </ul>
          </div>

          <!-- 权益保障 -->
          <div class="rights-section">
            <h4 class="section-title">✅ 您的权益：</h4>
            <div class="rights-grid">
              <div class="right-item">
                <span class="right-icon">🛡️</span>
                <span>完全匿名，不会暴露身份</span>
              </div>
              <div class="right-item">
                <span class="right-icon">🔄</span>
                <span>可随时撤回授权</span>
              </div>
              <div class="right-item">
                <span class="right-icon">🎁</span>
                <span>获得积分奖励，解锁高级功能</span>
              </div>
            </div>
          </div>

          <!-- 文件列表 -->
          <div v-if="examFiles.length > 0" class="files-section">
            <h4 class="section-title">📎 检测到的文件：</h4>
            <div class="files-list">
              <div v-for="file in examFiles" :key="file.id" class="file-item">
                <span class="file-icon">📄</span>
                <span class="file-name">{{ file.originalName }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="modal-footer">
          <div class="footer-info">
            <a href="#" class="link" @click.prevent="showPrivacy = true">隐私政策</a>
            <span class="divider">|</span>
            <a href="#" class="link" @click.prevent="showDetails = true">详细说明</a>
          </div>
          <div class="footer-actions">
            <button 
              class="btn btn-secondary" 
              @click="handleDecline"
              :disabled="loading"
            >
              仅自己使用
            </button>
            <button 
              class="btn btn-primary" 
              @click="handleConsent"
              :disabled="loading"
            >
              <span v-if="loading" class="loading-spinner"></span>
              <span v-else>✅ 同意并上传 (+50积分)</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐私政策弹窗 -->
    <div v-if="showPrivacy" class="consent-modal-overlay" @click.self="showPrivacy = false">
      <div class="consent-modal sub-modal">
        <div class="modal-header">
          <h3 class="header-title">隐私政策</h3>
          <button class="close-btn" @click="showPrivacy = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="policy-content">
            <h4>1. 数据收集</h4>
            <p>我们仅收集您主动上传的真题文件内容，用于生成考点分析和预测。</p>
            
            <h4>2. 匿名处理</h4>
            <p>我们不会收集您的姓名、学号、手机号等个人身份信息。仅使用匿名会话ID标识。</p>
            
            <h4>3. 数据使用</h4>
            <p>您同意共享的真题将用于：</p>
            <ul>
              <li>为其他用户提供考点分析和预测</li>
              <li>统计考点出现频率和趋势</li>
              <li>改进我们的AI分析算法</li>
            </ul>
            
            <h4>4. 数据安全</h4>
            <p>我们采用加密存储和传输，确保数据安全。不会将数据出售给第三方。</p>
            
            <h4>5. 撤回授权</h4>
            <p>您随时可以联系我们撤回授权，我们将删除您共享的真题数据。</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showPrivacy = false">我知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { submitExamConsent } from '../api'

const props = defineProps({
  visible: Boolean,
  examFiles: {
    type: Array,
    default: () => []
  },
  analysisId: String,
})

const emit = defineEmits(['close', 'consent', 'decline'])

const loading = ref(false)
const showPrivacy = ref(false)
const showDetails = ref(false)

function handleClose() {
  if (!loading.value) {
    emit('close')
  }
}

async function handleConsent() {
  loading.value = true
  try {
    // 提交同意授权
    await submitExamConsent({
      analysisId: props.analysisId,
      consent: true,
      fileIds: props.examFiles.map(f => f.id),
    })
    emit('consent', { agreed: true, files: props.examFiles })
  } catch (error) {
    console.error('提交授权失败:', error)
    alert('提交失败，请重试')
  } finally {
    loading.value = false
  }
}

async function handleDecline() {
  loading.value = true
  try {
    // 提交拒绝授权
    await submitExamConsent({
      analysisId: props.analysisId,
      consent: false,
      fileIds: props.examFiles.map(f => f.id),
    })
    emit('decline', { agreed: false, files: props.examFiles })
  } catch (error) {
    console.error('提交拒绝失败:', error)
    // 即使失败也继续，不影响用户分析
    emit('decline', { agreed: false, files: props.examFiles })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.consent-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.consent-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.sub-modal {
  max-width: 480px;
}

/* 头部 */
.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.25rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.header-icon {
  font-size: 1.5rem;
}

.header-title {
  flex: 1;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* 内容区 */
.modal-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.detected-info {
  font-size: 0.9375rem;
  color: #374151;
  margin: 0 0 1rem;
  line-height: 1.5;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.625rem;
}

/* 价值说明 */
.value-section {
  background: #eff6ff;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.value-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.value-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.5;
}

.value-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

/* 权益保障 */
.rights-section {
  margin-bottom: 1rem;
}

.rights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.right-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  background: #f9fafb;
  border-radius: 10px;
  text-align: center;
}

.right-icon {
  font-size: 1.25rem;
}

.right-item span:last-child {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.4;
}

/* 文件列表 */
.files-section {
  margin-bottom: 0.5rem;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.file-icon {
  font-size: 1rem;
}

.file-name {
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部 */
.modal-footer {
  padding: 0.875rem 1.25rem 1.25rem;
  border-top: 1px solid #f3f4f6;
}

.footer-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  font-size: 0.75rem;
}

.link {
  color: #6b7280;
  text-decoration: none;
}

.link:hover {
  color: #3b82f6;
  text-decoration: underline;
}

.divider {
  color: #d1d5db;
}

.footer-actions {
  display: flex;
  gap: 0.625rem;
}

.btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 隐私政策内容 */
.policy-content {
  font-size: 0.875rem;
  line-height: 1.7;
  color: #374151;
}

.policy-content h4 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
  margin: 1rem 0 0.5rem;
}

.policy-content h4:first-child {
  margin-top: 0;
}

.policy-content p {
  margin: 0 0 0.75rem;
}

.policy-content ul {
  margin: 0 0 0.75rem;
  padding-left: 1.25rem;
}

.policy-content li {
  margin: 0.25rem 0;
}

/* 响应式 */
@media (max-width: 480px) {
  .rights-grid {
    grid-template-columns: 1fr;
  }
  
  .right-item {
    flex-direction: row;
    text-align: left;
    padding: 0.625rem 0.875rem;
  }
  
  .footer-actions {
    flex-direction: column;
  }
}
</style>
