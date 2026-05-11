/**
 * 文件上传路由
 *
 * 功能：
 * - 使用multer处理多文件上传
 * - 支持PDF和TXT格式
 * - 文件大小限制50MB
 * - 返回上传文件列表及元信息
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();

// ============================================
// Multer 存储配置
// ============================================

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// 确保上传目录存在
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 自定义存储：生成唯一文件名，保留原始扩展名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 处理中文文件名编码问题：multer 可能以 latin1 编码传递非 ASCII 文件名
    let originalName = file.originalname;
    if (Buffer.isBuffer(originalName)) {
      originalName = originalName.toString('utf8');
    } else {
      // latin1 编码的字符串，需要先转 Buffer 再用 utf8 解码
      try {
        const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
        // 如果解码后包含合法中文，使用解码后的结果
        if (/[^\x00-\x7F]/.test(decoded)) {
          originalName = decoded;
        }
      } catch (e) {
        // 解码失败则保持原样
      }
    }
    // 生成格式: timestamp_randomHash.originalExt
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    // 保存原始文件名供后续使用
    file.originalname = originalName;
    cb(null, `${timestamp}_${hash}${ext}`);
  },
});

// 文件过滤器
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/x-pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.doc', '.docx'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype || ext}。仅支持 PDF、TXT、DOC、DOCX 文件。`), false);
  }
}

// Multer 实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    files: 10, // 最多同时上传10个文件
  },
});

// ============================================
// 路由定义
// ============================================

/**
 * POST /api/upload
 * 多文件上传接口
 *
 * 请求: multipart/form-data
 * - files: 文件字段（支持多文件）
 *
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     files: [
 *       {
 *         id: "文件唯一ID",
 *         originalName: "原始文件名",
 *         savedName: "服务器存储文件名",
 *         path: "文件路径",
 *         size: 文件大小(字节),
 *         mimeType: "MIME类型",
 *         uploadedAt: "上传时间ISO字符串"
 *       }
 *     ],
 *     totalFiles: 上传文件数量,
 *     totalSize: 总大小(字节)
 *   }
 * }
 */
router.post('/', (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      // Multer 错误处理
      if (err instanceof multer.MulterError) {
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            return res.status(413).json({
              success: false,
              error: {
                code: 'FILE_TOO_LARGE',
                message: `文件 "${err.field}" 超过大小限制（最大 ${parseInt(process.env.MAX_FILE_SIZE) / 1024 / 1024}MB）`,
              },
            });
          case 'LIMIT_FILE_COUNT':
            return res.status(400).json({
              success: false,
              error: {
                code: 'TOO_MANY_FILES',
                message: '上传文件数量超过限制（最多10个文件）',
              },
            });
          case 'LIMIT_UNEXPECTED_FILE':
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_FILE_FIELD',
                message: '文件字段名不正确，请使用 "files" 作为字段名',
              },
            });
          default:
            return res.status(400).json({
              success: false,
              error: {
                code: 'UPLOAD_ERROR',
                message: `上传错误: ${err.message}`,
              },
            });
        }
      }

      // 自定义错误（如文件类型不匹配）
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: err.message || '文件上传失败',
        },
      });
    }

    // 检查是否有文件
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES',
          message: '未接收到任何文件，请选择文件后重试',
        },
      });
    }

    // 构建文件信息列表
    const files = req.files.map((file) => ({
      id: crypto.randomUUID(),
      originalName: file.originalname,
      savedName: file.filename,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    }));

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    res.json({
      success: true,
      data: {
        files,
        totalFiles: files.length,
        totalSize,
      },
    });
  });
});

/**
 * DELETE /api/upload/:fileId
 * 删除已上传的文件
 *
 * 注意：此接口通过文件名删除，实际使用中可能需要文件管理服务
 */
router.delete('/:fileName', (req, res) => {
  const { fileName } = req.params;

  // 安全检查：防止路径遍历攻击
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_NAME',
        message: '无效的文件名',
      },
    });
  }

  const filePath = path.join(uploadDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: '文件不存在',
      },
    });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({
      success: true,
      data: {
        message: '文件删除成功',
        fileName,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: '文件删除失败',
      },
    });
  }
});

/**
 * GET /api/upload
 * 获取已上传文件列表
 */
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir)
      .filter((name) => {
        const ext = path.extname(name).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      })
      .map((name) => {
        const filePath = path.join(uploadDir, name);
        const stats = fs.statSync(filePath);
        return {
          savedName: name,
          size: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
          path: filePath,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      success: true,
      data: {
        files,
        totalFiles: files.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FAILED',
        message: '获取文件列表失败',
      },
    });
  }
});

module.exports = router;
