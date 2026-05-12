/**
 * AI课程复习助手 - Express服务器入口
 *
 * 功能：
 * - 配置Express中间件（CORS、JSON解析、文件上传）
 * - 注册路由模块
 * - 错误处理
 * - 启动HTTP服务
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const uploadRoutes = require('./routes/upload');
const analyzeRoutes = require('./routes/analyze');
const feedbackRoutes = require('./routes/feedback');
const examRoutes = require('./routes/exam');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// 中间件配置
// ============================================

// CORS 跨域配置
app.use(cors({
  origin: true, // 允许所有来源（部署时需要）
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-Id'],
  credentials: true,
  maxAge: 86400,
}));

// JSON 请求体解析
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务 - 提供上传文件的访问
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// ============================================
// 路由注册
// ============================================

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// 业务路由
app.use('/api/upload', uploadRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/exam', examRoutes);

// ============================================
// 错误处理
// ============================================

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `接口不存在: ${req.method} ${req.path}`,
    },
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] 未捕获的错误:`, err);

  // Multer 文件大小超限错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `文件大小超过限制（最大 ${process.env.MAX_FILE_SIZE || 50}MB）`,
      },
    });
  }

  // Multer 文件数量超限错误
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_FIELD',
        message: '文件字段名不正确，请使用 "files" 作为字段名',
      },
    });
  }

  // JSON 解析错误
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: '请求体JSON格式错误',
      },
    });
  }

  // 默认服务器错误
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development'
        ? err.message
        : '服务器内部错误，请稍后重试',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// ============================================
// 启动服务器
// ============================================

app.listen(PORT, async () => {
  // 初始化数据库
  try {
    await db.initDatabase();
  } catch (err) {
    console.error('数据库初始化失败，真题库功能将不可用:', err.message);
  }

  console.log('============================================');
  console.log('  AI课程复习助手 后端服务已启动');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  DeepSeek Model: ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}`);
  console.log('============================================');
});

// 优雅退出处理
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});

module.exports = app;
