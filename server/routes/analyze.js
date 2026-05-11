/**
 * AI分析路由
 *
 * 功能：
 * - 接收文件列表和用户配置
 * - 调用AI分析流水线处理
 * - 支持流式和非流式两种响应模式
 * - 返回结构化的复习分析结果
 */

const express = require('express');
const router = express.Router();
const analyzePipeline = require('../services/analyzePipeline');

// ============================================
// 路由定义
// ============================================

/**
 * POST /api/analyze
 * AI分析接口（非流式）
 *
 * 请求体:
 * {
 *   files: [
 *     {
 *       id: "文件ID",
 *       path: "文件路径",
 *       originalName: "原始文件名"
 *     }
 *   ],
 *   config: {
 *     courseName: "课程名称",
 *     examDate: "考试日期 (可选)",
 *     priorityMode: "normal" | "emergency",  // 优先级模式
 *     customPrompt: "自定义补充说明 (可选)",
 *     detailLevel: "concise" | "normal" | "detailed"  // 详细程度
 *   }
 * }
 *
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     priorityReport: { ... },
 *     fullDocument: { ... },
 *     emergencyDocument: { ... },
 *     metadata: { ... }
 *   }
 * }
 */
router.post('/', async (req, res) => {
  const { files, config = {} } = req.body;

  // ============================================
  // 参数验证
  // ============================================
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILES',
        message: '请提供至少一个文件进行分析',
      },
    });
  }

  // 验证每个文件对象
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.path) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_DATA',
          message: `第 ${i + 1} 个文件缺少 path 字段`,
        },
      });
    }
  }

  // 验证配置
  const validPriorityModes = ['normal', 'emergency'];
  if (config.priorityMode && !validPriorityModes.includes(config.priorityMode)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CONFIG',
        message: `priorityMode 必须是 ${validPriorityModes.join(' 或 ')} 之一`,
      },
    });
  }

  const validDetailLevels = ['concise', 'normal', 'detailed'];
  if (config.detailLevel && !validDetailLevels.includes(config.detailLevel)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CONFIG',
        message: `detailLevel 必须是 ${validDetailLevels.join(' 或 ')} 之一`,
      },
    });
  }

  // 验证OCR模式
  const validOcrModes = ['fast', 'slow'];
  if (config.ocrMode && !validOcrModes.includes(config.ocrMode)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CONFIG',
        message: `ocrMode 必须是 ${validOcrModes.join(' 或 ')} 之一`,
      },
    });
  }

  // ============================================
  // 执行分析
  // ============================================
  try {
    console.log(`[${req.requestId}] 开始AI分析，文件数量: ${files.length}`);

    const result = await analyzePipeline.run(files, {
      ...config,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: result,
    });

    console.log(`[${req.requestId}] AI分析完成`);
  } catch (error) {
    console.error(`[${req.requestId}] AI分析失败:`, error);

    // 根据错误类型返回不同的状态码
    if (error.code === 'FILE_READ_ERROR') {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    if (error.code === 'AI_API_ERROR' || error.code === 'AI_TIMEOUT') {
      return res.status(502).json({
        success: false,
        error: {
          code: error.code,
          message: `AI服务调用失败: ${error.message}`,
        },
      });
    }

    if (error.code === 'AI_RESPONSE_PARSE_ERROR') {
      return res.status(502).json({
        success: false,
        error: {
          code: error.code,
          message: 'AI返回结果解析失败，请重试',
        },
      });
    }

    // 默认错误
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: '分析过程中发生错误，请稍后重试',
      },
    });
  }
});

/**
 * POST /api/analyze/stream
 * AI分析接口（流式响应）
 *
 * 请求体同上，响应为 Server-Sent Events (SSE) 格式
 *
 * 事件类型:
 * - progress: 处理进度更新
 * - result: 最终结果
 * - error: 错误信息
 */
router.post('/stream', async (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
  res.flushHeaders();

  const { files, config = {} } = req.body;

  // 参数验证（同上）
  if (!files || !Array.isArray(files) || files.length === 0) {
    res.write(`event: error\ndata: ${JSON.stringify({
      code: 'INVALID_FILES',
      message: '请提供至少一个文件进行分析',
    })}\n\n`);
    res.end();
    return;
  }

  for (let i = 0; i < files.length; i++) {
    if (!files[i].path) {
      res.write(`event: error\ndata: ${JSON.stringify({
        code: 'INVALID_FILE_DATA',
        message: `第 ${i + 1} 个文件缺少 path 字段`,
      })}\n\n`);
      res.end();
      return;
    }
  }

  // 发送进度事件的辅助函数
  const sendProgress = (stage, message, progress = 0) => {
    res.write(`event: progress\ndata: ${JSON.stringify({
      stage,
      message,
      progress,
      timestamp: new Date().toISOString(),
    })}\n\n`);
  };

  try {
    sendProgress('init', '开始分析...', 0);
    console.log(`[${req.requestId}] 开始流式AI分析，文件数量: ${files.length}`);

    const result = await analyzePipeline.run(files, {
      ...config,
      requestId: req.requestId,
      onProgress: sendProgress,
    });

    sendProgress('complete', '分析完成', 100);

    res.write(`event: result\ndata: ${JSON.stringify({
      success: true,
      data: result,
    })}\n\n`);
  } catch (error) {
    console.error(`[${req.requestId}] 流式AI分析失败:`, error);
    res.write(`event: error\ndata: ${JSON.stringify({
      code: error.code || 'ANALYSIS_FAILED',
      message: error.message || '分析过程中发生错误',
    })}\n\n`);
  } finally {
    res.end();
  }
});

/**
 * POST /api/analyze/preview
 * 快速预览接口 - 仅提取文本和识别类型，不进行AI分析
 *
 * 请求体:
 * {
 *   files: [{ path: "文件路径", originalName: "原始文件名" }]
 * }
 *
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     files: [
 *       {
 *         originalName: "文件名",
 *         type: "exam" | "ppt" | "notes" | "unknown",
 *         textPreview: "前500字预览...",
 *         pageCount: 10,
 *         charCount: 5000
 *       }
 *     ]
 *   }
 * }
 */
router.post('/preview', async (req, res) => {
  const { files } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILES',
        message: '请提供至少一个文件',
      },
    });
  }

  try {
    const pdfParser = require('../services/pdfParser');
    const typeDetector = require('../services/typeDetector');

    const previews = await Promise.all(
      files.map(async (file) => {
        try {
          const parsed = await pdfParser.parse(file.path);
          const type = typeDetector.detect(parsed.text, file.originalName);

          return {
            originalName: file.originalName,
            type: type.type,
            confidence: type.confidence,
            matchedRules: type.matchedRules,
            textPreview: parsed.text.substring(0, 500) + (parsed.text.length > 500 ? '...' : ''),
            pageCount: parsed.pageCount || 0,
            charCount: parsed.text.length,
          };
        } catch (err) {
          return {
            originalName: file.originalName,
            type: 'error',
            error: err.message,
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        files: previews,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PREVIEW_FAILED',
        message: '预览失败',
      },
    });
  }
});

/**
 * POST /api/analyze/export
 * 导出分析报告
 *
 * 请求体:
 * {
 *   result: { ...分析结果对象 },
 *   format: "pdf" | "docx" | "markdown"
 * }
 */
router.post('/export', async (req, res) => {
  const { result, format } = req.body;

  if (!result) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_RESULT',
        message: '请提供分析结果',
      },
    });
  }

  if (!['docx', 'markdown'].includes(format)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: '不支持的导出格式，请使用 docx 或 markdown',
      },
    });
  }

  try {
    const exportService = require('../services/exportService');
    const { buffer, filename, contentType } = await exportService.export(result, format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error(`[${req.requestId}] 导出失败:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: error.message || '导出失败',
      },
    });
  }
});

module.exports = router;
