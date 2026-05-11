/**
 * 真题库相关路由
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/exam/consent
 * 提交真题共享授权
 */
router.post('/consent', async (req, res) => {
  const { analysisId, consent, fileIds } = req.body;
  const sessionId = req.sessionId || req.headers['x-session-id'] || 'anonymous';
  
  if (!analysisId || !fileIds || !Array.isArray(fileIds)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: '缺少必要参数',
      },
    });
  }

  try {
    for (const fileId of fileIds) {
      // 1. 先检查 exam_papers 表中是否已有记录
      const existing = await db.query(
        'SELECT id FROM exam_papers WHERE file_id = ?',
        [fileId]
      );

      let examPaperId;

      if (existing.length > 0) {
        // 已有记录，更新授权状态
        examPaperId = existing[0].id;
        await db.query(
          `UPDATE exam_papers 
           SET share_consent = ?, consent_at = NOW(), status = ?
           WHERE file_id = ?`,
          [consent, consent ? 'pending' : 'private', fileId]
        );
      } else {
        // 没有记录，创建一条（待后续分析时完善）
        examPaperId = uuidv4();
        await db.query(
          `INSERT INTO exam_papers 
           (id, file_id, course_name, uploader_session, share_consent, consent_at, status)
           VALUES (?, ?, '未命名', ?, ?, NOW(), ?)`,
          [examPaperId, fileId, sessionId, consent, consent ? 'pending' : 'private']
        );
      }

      // 2. 记录授权日志（只有创建 exam_paper 成功后才记录）
      if (examPaperId) {
        await db.query(
          `INSERT INTO user_consent_logs 
           (id, session_id, exam_paper_id, consent_type, consent_value, ip_hash, user_agent_hash)
           VALUES (?, ?, ?, 'share_exam', ?, ?, ?)`,
          [
            uuidv4(),
            sessionId,
            examPaperId,
            consent,
            hashIp(req.ip),
            hashUserAgent(req.headers['user-agent']),
          ]
        );
      }
    }

    // 如果同意共享，给予积分奖励
    if (consent) {
      await addPoints(sessionId, 50 * fileIds.length, 'share_exam', '共享真题奖励', fileIds[0]);
    }

    res.json({
      success: true,
      data: {
        consent,
        points: consent ? 50 * fileIds.length : 0,
        message: consent ? `感谢共享！获得 ${50 * fileIds.length} 积分` : '已设置为仅自己使用',
      },
    });
  } catch (error) {
    logger.error('保存授权失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SAVE_CONSENT_FAILED',
        message: '保存授权失败，请重试',
      },
    });
  }
});

/**
 * GET /api/exam/stats/:courseName
 * 获取课程考点统计
 */
router.get('/stats/:courseName', async (req, res) => {
  const { courseName } = req.params;
  const { school, limit = 20 } = req.query;

  try {
    const stats = await db.query(
      `SELECT * FROM knowledge_point_stats
       WHERE course_name = ? AND (school = ? OR ? IS NULL)
       ORDER BY prediction_score DESC
       LIMIT ?`,
      [courseName, school, school, parseInt(limit)]
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('获取考点统计失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_FAILED',
        message: '获取考点统计失败',
      },
    });
  }
});

/**
 * GET /api/exam/list
 * 获取真题列表
 */
router.get('/list', async (req, res) => {
  const { courseName, school, year, page = 1, limit = 10 } = req.query;

  try {
    let whereClause = 'WHERE share_consent = TRUE';
    const params = [];

    if (courseName) {
      whereClause += ' AND course_name = ?';
      params.push(courseName);
    }
    if (school) {
      whereClause += ' AND school = ?';
      params.push(school);
    }
    if (year) {
      whereClause += ' AND year = ?';
      params.push(year);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const exams = await db.query(
      `SELECT id, course_name, school, year, semester, exam_type, 
              question_count, download_count, reference_count, created_at
       FROM exam_papers
       ${whereClause}
       ORDER BY year DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    res.json({
      success: true,
      data: exams,
    });
  } catch (error) {
    logger.error('获取真题列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_LIST_FAILED',
        message: '获取真题列表失败',
      },
    });
  }
});

/**
 * GET /api/exam/:id/questions
 * 获取真题题目详情
 */
router.get('/:id/questions', async (req, res) => {
  const { id } = req.params;
  const sessionId = req.sessionId || req.headers['x-session-id'] || 'anonymous';

  try {
    // 检查真题是否存在
    const [exam] = await db.query(
      'SELECT * FROM exam_papers WHERE id = ?',
      [id]
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '真题不存在' },
      });
    }

    // 检查是否有权限：自己上传的 / 已共享 / 已积分解锁
    let isUnlocked = exam.uploader_session === sessionId || exam.share_consent === true;

    if (!isUnlocked) {
      // 检查是否通过积分解锁过
      const [unlockLog] = await db.query(
        `SELECT id FROM user_consent_logs 
         WHERE session_id = ? AND exam_paper_id = ? AND consent_type = 'unlock_exam'`,
        [sessionId, id]
      );
      isUnlocked = !!unlockLog;
    }

    if (!isUnlocked) {
      return res.json({
        success: true,
        data: {
          exam: {
            id: exam.id,
            course_name: exam.course_name,
            year: exam.year,
            semester: exam.semester,
            exam_type: exam.exam_type,
            school: exam.school,
            question_count: exam.question_count,
          },
          questions: [],
          isUnlocked: false,
        },
      });
    }

    const questions = await db.query(
      `SELECT id, question_number, question_type, content, answer, score,
              chapter, knowledge_point, difficulty
       FROM exam_questions
       WHERE exam_paper_id = ?
       ORDER BY question_number`,
      [id]
    );

    res.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          course_name: exam.course_name,
          year: exam.year,
          semester: exam.semester,
          exam_type: exam.exam_type,
          school: exam.school,
          question_count: exam.question_count,
        },
        questions,
        isUnlocked: true,
      },
    });
  } catch (error) {
    logger.error('获取题目失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_QUESTIONS_FAILED', message: '获取题目失败' },
    });
  }
});

/**
 * GET /api/exam/points
 * 获取用户积分
 */
router.get('/points', async (req, res) => {
  const sessionId = req.sessionId || req.headers['x-session-id'] || 'anonymous';

  try {
    const [user] = await db.query(
      'SELECT total_points FROM user_points WHERE session_id = ?',
      [sessionId]
    );

    res.json({
      success: true,
      data: {
        points: user?.total_points || 0,
        sessionId,
      },
    });
  } catch (error) {
    logger.error('获取积分失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_POINTS_FAILED', message: '获取积分失败' },
    });
  }
});

/**
 * POST /api/exam/unlock/:id
 * 使用积分解锁真题
 */
router.post('/unlock/:id', async (req, res) => {
  const { id } = req.params;
  const sessionId = req.sessionId || req.headers['x-session-id'] || 'anonymous';
  const UNLOCK_COST = 10; // 解锁一份真题需要10积分

  try {
    // 检查真题是否存在
    const [exam] = await db.query(
      'SELECT * FROM exam_papers WHERE id = ?',
      [id]
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '真题不存在' },
      });
    }

    // 检查是否已解锁（自己上传的或已解锁过）
    if (exam.uploader_session === sessionId) {
      return res.json({
        success: true,
        data: { alreadyUnlocked: true, message: '这是您上传的真题' },
      });
    }

    // 检查是否已解锁过
    const [unlockLog] = await db.query(
      `SELECT id FROM user_consent_logs 
       WHERE session_id = ? AND exam_paper_id = ? AND consent_type = 'unlock_exam'`,
      [sessionId, id]
    );

    if (unlockLog) {
      return res.json({
        success: true,
        data: { alreadyUnlocked: true, message: '已解锁过此真题' },
      });
    }

    // 检查积分是否足够
    const [userPoints] = await db.query(
      'SELECT total_points FROM user_points WHERE session_id = ?',
      [sessionId]
    );

    const currentPoints = userPoints?.total_points || 0;
    if (currentPoints < UNLOCK_COST) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INSUFFICIENT_POINTS', 
          message: `积分不足，需要${UNLOCK_COST}积分，当前${currentPoints}积分`,
          required: UNLOCK_COST,
          current: currentPoints,
        },
      });
    }

    // 扣除积分
    await db.query(
      'UPDATE user_points SET total_points = total_points - ? WHERE session_id = ?',
      [UNLOCK_COST, sessionId]
    );

    // 记录解锁日志
    await db.query(
      `INSERT INTO user_consent_logs 
       (id, session_id, exam_paper_id, consent_type, consent_value, ip_hash, user_agent_hash)
       VALUES (?, ?, ?, 'unlock_exam', TRUE, ?, ?)`,
      [uuidv4(), sessionId, id, hashIp(req.ip), hashUserAgent(req.headers['user-agent'])]
    );

    // 更新真题下载次数
    await db.query(
      'UPDATE exam_papers SET download_count = download_count + 1 WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        unlocked: true,
        cost: UNLOCK_COST,
        remainingPoints: currentPoints - UNLOCK_COST,
      },
    });
  } catch (error) {
    logger.error('解锁真题失败:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UNLOCK_FAILED', message: '解锁失败，请重试' },
    });
  }
});

// 辅助函数
function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex').slice(0, 16);
}

function hashUserAgent(ua) {
  return crypto.createHash('sha256').update(ua || '').digest('hex').slice(0, 16);
}

async function addPoints(sessionId, points, type, description, relatedExamId) {
  try {
    // 确保用户积分记录存在
    await db.query(
      `INSERT INTO user_points (id, session_id, total_points)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [uuidv4(), sessionId]
    );

    // 添加积分变动记录
    await db.query(
      `INSERT INTO point_transactions (id, session_id, transaction_type, points, description, related_exam_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), sessionId, type, points, description, relatedExamId]
    );

    // 更新总积分
    await db.query(
      `UPDATE user_points SET total_points = total_points + ? WHERE session_id = ?`,
      [points, sessionId]
    );
  } catch (error) {
    logger.error('添加积分失败:', error);
  }
}

module.exports = router;
