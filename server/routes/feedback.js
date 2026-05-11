/**
 * 反馈路由
 *
 * 功能：
 * - 保存用户对AI分析结果的反馈
 * - 支持评分、评论和建议
 * - 反馈数据存储在本地JSON文件中（可扩展为数据库）
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 反馈数据存储目录
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化反馈文件
if (!fs.existsSync(FEEDBACK_FILE)) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// ============================================
// 辅助函数
// ============================================

/**
 * 读取所有反馈数据
 */
function readFeedbacks() {
  try {
    const data = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取反馈数据失败:', error);
    return [];
  }
}

/**
 * 写入反馈数据
 */
function writeFeedbacks(feedbacks) {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('写入反馈数据失败:', error);
    return false;
  }
}

// ============================================
// 路由定义
// ============================================

/**
 * POST /api/feedback
 * 提交用户反馈
 *
 * 请求体:
 * {
 *   analysisId: "分析任务ID (可选)",
 *   rating: 1-5,                      // 评分（必填）
 *   category: "accuracy" | "usefulness" | "completeness" | "other",  // 反馈类别
 *   comment: "用户评论 (可选)",
 *   suggestions: "改进建议 (可选)",
 *   fileInfo: {                        // 相关文件信息 (可选)
 *     fileNames: ["文件1.pdf", "文件2.txt"],
 *     courseName: "课程名称"
 *   }
 * }
 */
router.post('/', (req, res) => {
  const { analysisId, rating, category, comment, suggestions, fileInfo } = req.body;

  // 参数验证
  if (rating === undefined || rating === null) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_RATING',
        message: '请提供评分（1-5）',
      },
    });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RATING',
        message: '评分必须是1到5之间的整数',
      },
    });
  }

  const validCategories = ['accuracy', 'usefulness', 'completeness', 'other'];
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CATEGORY',
        message: `反馈类别必须是 ${validCategories.join('、')} 之一`,
      },
    });
  }

  // 构建反馈记录
  const feedback = {
    id: crypto.randomUUID(),
    analysisId: analysisId || null,
    rating,
    category: category || 'other',
    comment: (comment || '').trim().substring(0, 1000), // 限制评论长度
    suggestions: (suggestions || '').trim().substring(0, 500), // 限制建议长度
    fileInfo: fileInfo || null,
    createdAt: new Date().toISOString(),
    requestId: req.requestId || null,
  };

  // 保存反馈
  const feedbacks = readFeedbacks();
  feedbacks.push(feedback);

  const saved = writeFeedbacks(feedbacks);
  if (!saved) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: '反馈保存失败，请稍后重试',
      },
    });
  }

  res.json({
    success: true,
    data: {
      id: feedback.id,
      message: '感谢您的反馈！',
    },
  });
});

/**
 * GET /api/feedback
 * 获取反馈列表（管理接口）
 *
 * 查询参数:
 * - limit: 返回数量限制（默认20）
 * - offset: 偏移量（默认0）
 * - category: 按类别筛选（可选）
 * - minRating: 最低评分筛选（可选）
 */
router.get('/', (req, res) => {
  const { limit = 20, offset = 0, category, minRating } = req.query;

  let feedbacks = readFeedbacks();

  // 按类别筛选
  if (category) {
    feedbacks = feedbacks.filter((f) => f.category === category);
  }

  // 按最低评分筛选
  if (minRating) {
    const min = parseInt(minRating);
    if (!isNaN(min)) {
      feedbacks = feedbacks.filter((f) => f.rating >= min);
    }
  }

  // 按时间倒序排列
  feedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 分页
  const total = feedbacks.length;
  const paginatedFeedbacks = feedbacks.slice(
    parseInt(offset),
    parseInt(offset) + parseInt(limit)
  );

  // 计算统计信息
  const stats = {
    total,
    averageRating: total > 0
      ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(2)
      : 0,
    ratingDistribution: {
      5: feedbacks.filter((f) => f.rating === 5).length,
      4: feedbacks.filter((f) => f.rating === 4).length,
      3: feedbacks.filter((f) => f.rating === 3).length,
      2: feedbacks.filter((f) => f.rating === 2).length,
      1: feedbacks.filter((f) => f.rating === 1).length,
    },
  };

  res.json({
    success: true,
    data: {
      feedbacks: paginatedFeedbacks,
      stats,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    },
  });
});

/**
 * GET /api/feedback/stats
 * 获取反馈统计摘要
 */
router.get('/stats', (req, res) => {
  const feedbacks = readFeedbacks();
  const total = feedbacks.length;

  const stats = {
    totalFeedbacks: total,
    averageRating: total > 0
      ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(2)
      : 'N/A',
    ratingDistribution: {
      5: feedbacks.filter((f) => f.rating === 5).length,
      4: feedbacks.filter((f) => f.rating === 4).length,
      3: feedbacks.filter((f) => f.rating === 3).length,
      2: feedbacks.filter((f) => f.rating === 2).length,
      1: feedbacks.filter((f) => f.rating === 1).length,
    },
    categoryDistribution: {
      accuracy: feedbacks.filter((f) => f.category === 'accuracy').length,
      usefulness: feedbacks.filter((f) => f.category === 'usefulness').length,
      completeness: feedbacks.filter((f) => f.category === 'completeness').length,
      other: feedbacks.filter((f) => f.category === 'other').length,
    },
    recentComments: feedbacks
      .filter((f) => f.comment)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((f) => ({
        rating: f.rating,
        comment: f.comment,
        createdAt: f.createdAt,
      })),
  };

  res.json({
    success: true,
    data: stats,
  });
});

module.exports = router;
