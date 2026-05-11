/**
 * PDF/TXT/DOC/DOCX 文件解析服务
 *
 * 功能：
 * - 解析PDF文件，提取文本内容和页数信息
 * - 解析TXT纯文本文件
 * - 解析DOCX Word文档
 * - 处理编码问题（自动检测UTF-8/GBK）
 * - 文本预处理（去除多余空白、规范化换行等）
 */

const fs = require('fs');
const path = require('path');

// 延迟加载 pdf-parse，避免在不需要时加载
let pdfParse = null;

function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = require('pdf-parse');
    } catch (error) {
      throw new Error('pdf-parse 模块未安装，请运行: npm install pdf-parse');
    }
  }
  return pdfParse;
}

// 延迟加载 mammoth (用于解析 docx)
let mammoth = null;

function getMammoth() {
  if (!mammoth) {
    try {
      mammoth = require('mammoth');
    } catch (error) {
      throw new Error('mammoth 模块未安装，请运行: npm install mammoth');
    }
  }
  return mammoth;
}

class PdfParserService {
  constructor() {
    this.supportedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
  }

  /**
   * 解析文件
   * @param {string} filePath - 文件绝对路径
   * @param {object} options - 解析选项
   * @param {number} options.maxChars - 最大提取字符数（默认500000）
   * @returns {Promise<{text: string, pageCount: number, metadata: object}>}
   */
  async parse(filePath, options = {}) {
    const { maxChars = 500000 } = options;

    // 验证文件存在
    if (!fs.existsSync(filePath)) {
      const error = new Error(`文件不存在: ${filePath}`);
      error.code = 'FILE_READ_ERROR';
      throw error;
    }

    // 验证文件类型
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) {
      const error = new Error(`不支持的文件类型: ${ext}。仅支持 ${this.supportedExtensions.join(', ')}`);
      error.code = 'FILE_READ_ERROR';
      throw error;
    }

    // 根据文件类型选择解析方式
    if (ext === '.pdf') {
      return this.parsePdf(filePath, { maxChars });
    } else if (ext === '.txt') {
      return this.parseTxt(filePath, { maxChars });
    } else if (ext === '.docx') {
      return this.parseDocx(filePath, { maxChars });
    } else if (ext === '.doc') {
      // .doc 是旧格式，需要额外处理，暂时提示用户转换
      const error = new Error(`暂不支持 .doc 格式，请将文件转换为 .docx 格式后上传`);
      error.code = 'FILE_READ_ERROR';
      throw error;
    }
  }

  /**
   * 解析PDF文件
   */
  async parsePdf(filePath, options = {}) {
    const { maxChars = 500000, ocrMode = 'slow' } = options;

    try {
      const pdfParse = getPdfParse();
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      let text = data.text || '';

      // 文本预处理
      text = this.preprocessText(text);

      // 截断过长文本
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
        console.warn(`PDF文本过长，已截断至 ${maxChars} 字符`);
      }

      const pageCount = data.numpages || 0;

      // 检查是否需要OCR（扫描件/图片PDF）
      if (this._needsOCR(text, pageCount)) {
        console.log(`[PDF解析] 文本内容过少(${text.length}字符, ${pageCount}页)，尝试OCR识别...`);
        try {
          const ocrService = require('./ocrService');
          const ocrResult = await ocrService.recognizePdf(filePath, { maxPages: 50, ocrMode });

          if (ocrResult.text && ocrResult.text.trim().length > text.length) {
            console.log(`[PDF解析] OCR识别成功，提取${ocrResult.text.length}字符`);
            text = ocrResult.text;
            if (text.length > maxChars) {
              text = text.substring(0, maxChars);
            }
            return {
              text,
              pageCount: ocrResult.pageCount || pageCount,
              metadata: {
                title: data.info?.Title || '',
                author: data.info?.Author || '',
                ocrUsed: true,
                ocrPages: ocrResult.pageCount,
              },
            };
          } else {
            console.log(`[PDF解析] OCR未提取到更多内容，使用原始文本`);
          }
        } catch (ocrError) {
          console.warn(`[PDF解析] OCR失败，使用原始文本: ${ocrError.message}`);
        }
      }

      return {
        text,
        pageCount,
        metadata: {
          title: data.info?.Title || '',
          author: data.info?.Author || '',
          creator: data.info?.Creator || '',
          producer: data.info?.Producer || '',
          creationDate: data.info?.CreationDate || '',
          modificationDate: data.info?.ModDate || '',
          pdfVersion: data.version || '',
          ocrUsed: false,
        },
      };
    } catch (error) {
      if (error.code === 'FILE_READ_ERROR') {
        throw error;
      }
      const wrappedError = new Error(`PDF解析失败: ${error.message}`);
      wrappedError.code = 'FILE_READ_ERROR';
      wrappedError.cause = error;
      throw wrappedError;
    }
  }

  /**
   * 检查是否需要OCR
   * 条件：文本为空 或 平均每页不到20个字符
   */
  _needsOCR(text, pageCount) {
    if (!text || text.trim().length === 0) return true;
    if (pageCount <= 0) return false;
    const avgCharsPerPage = text.length / pageCount;
    return avgCharsPerPage < 20;
  }

  /**
   * 解析TXT文件
   */
  async parseTxt(filePath, options = {}) {
    const { maxChars = 500000 } = options;

    try {
      let text = fs.readFileSync(filePath, 'utf-8');

      // 检查是否为乱码（包含大量替换字符），尝试GBK解码
      if (this.hasGarbledText(text)) {
        try {
          const iconv = require('iconv-lite');
          const buffer = fs.readFileSync(filePath);
          text = iconv.decode(buffer, 'gbk');
        } catch {
          // iconv-lite 不可用时，尝试使用Buffer手动转换
          console.warn('iconv-lite 未安装，无法进行GBK编码转换。建议安装: npm install iconv-lite');
        }
      }

      // 文本预处理
      text = this.preprocessText(text);

      // 截断过长文本
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
        console.warn(`TXT文本过长，已截断至 ${maxChars} 字符`);
      }

      // 估算页数（按每页约2000字符计算）
      const estimatedPages = Math.ceil(text.length / 2000);

      return {
        text,
        pageCount: estimatedPages,
        metadata: {
          encoding: 'utf-8',
          charCount: text.length,
          lineCount: text.split('\n').length,
        },
      };
    } catch (error) {
      if (error.code === 'FILE_READ_ERROR') {
        throw error;
      }
      const wrappedError = new Error(`TXT解析失败: ${error.message}`);
      wrappedError.code = 'FILE_READ_ERROR';
      wrappedError.cause = error;
      throw wrappedError;
    }
  }

  /**
   * 解析 DOCX 文件
   */
  async parseDocx(filePath, options = {}) {
    const { maxChars = 500000 } = options;

    try {
      const mammoth = getMammoth();
      const result = await mammoth.extractRawText({ path: filePath });

      let text = result.value || '';

      // 文本预处理
      text = this.preprocessText(text);

      // 截断过长文本
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
        console.warn(`DOCX文本过长，已截断至 ${maxChars} 字符`);
      }

      // 估算页数（按每页约2000字符计算）
      const estimatedPages = Math.ceil(text.length / 2000);

      return {
        text,
        pageCount: estimatedPages,
        metadata: {
          charCount: text.length,
          messages: result.messages || [],
        },
      };
    } catch (error) {
      if (error.code === 'FILE_READ_ERROR') {
        throw error;
      }
      const wrappedError = new Error(`DOCX解析失败: ${error.message}`);
      wrappedError.code = 'FILE_READ_ERROR';
      wrappedError.cause = error;
      throw wrappedError;
    }
  }

  /**
   * 文本预处理
   * - 去除多余空白
   * - 规范化换行符
   * - 去除特殊控制字符
   */
  preprocessText(text) {
    if (!text) return '';

    // 统一换行符为 \n
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 去除控制字符（保留换行和制表符）
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 将连续多个空行合并为一个
    text = text.replace(/\n{3,}/g, '\n\n');

    // 去除行首行尾空白
    text = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n');

    // 去除首尾空白
    text = text.trim();

    return text;
  }

  /**
   * 检测文本是否为乱码
   * 通过检查替换字符（U+FFFD）的比例来判断
   */
  hasGarbledText(text) {
    if (!text || text.length === 0) return false;
    const replacementCharCount = (text.match(/\uFFFD/g) || []).length;
    const ratio = replacementCharCount / text.length;
    return ratio > 0.01; // 超过1%的替换字符则认为是乱码
  }

  /**
   * 批量解析文件
   * @param {Array<{path: string, originalName: string}>} files - 文件列表
   * @param {object} options - 选项
   * @param {string} options.ocrMode - OCR模式: 'fast'(百度云) 或 'slow'(Tesseract)
   * @returns {Promise<Array<{originalName: string, text: string, pageCount: number, metadata: object}>>}
   */
  async parseBatch(files, options = {}) {
    const { ocrMode = 'slow' } = options;
    const results = [];

    for (const file of files) {
      try {
        const parsed = await this.parse(file.path, { ocrMode });
        results.push({
          originalName: file.originalName,
          ...parsed,
          success: true,
        });
      } catch (error) {
        results.push({
          originalName: file.originalName,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }
}

// 导出单例
module.exports = new PdfParserService();
