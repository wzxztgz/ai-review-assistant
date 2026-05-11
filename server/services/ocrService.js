/**
 * OCR 服务 - 双引擎支持
 *
 * 支持两种OCR引擎：
 * - 百度云OCR（快速、准确，但有免费额度限制）
 * - Tesseract.js（慢速、免费、本地运行）
 *
 * 使用方式：
 * - ocrMode: 'fast' -> 百度云OCR
 * - ocrMode: 'slow' -> Tesseract.js
 */

const fs = require('fs');
const path = require('path');

let pdfjsLib = null;
let tesseractWorker = null;

function getPdfjs() {
  if (!pdfjsLib) {
    try {
      pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    } catch (error) {
      throw new Error('pdfjs-dist 模块未安装，请运行: npm install pdfjs-dist');
    }
  }
  return pdfjsLib;
}

// 百度云OCR配置
const BAIDU_OCR_ENDPOINT = 'https://aip.baidubce.com';

class OcrService {
  constructor() {
    this.baiduAccessToken = null;
    this.baiduTokenExpireTime = 0;
    this.baiduApiKey = process.env.BAIDU_OCR_API_KEY;
    this.baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
  }

  /**
   * 检查文本是否为空或过短（需要OCR）
   */
  needsOCR(text, pageCount) {
    if (!text || text.trim().length === 0) return true;
    if (pageCount <= 0) return false;
    const avgCharsPerPage = text.length / pageCount;
    return avgCharsPerPage < 20;
  }

  /**
   * 对PDF文件进行OCR识别
   * @param {string} filePath - PDF文件路径
   * @param {object} options - 选项
   * @param {string} options.ocrMode - 'fast'(百度云) 或 'slow'(Tesseract)
   * @param {number} options.maxPages - 最大处理页数
   * @param {function} options.onProgress - 进度回调
   */
  async recognizePdf(filePath, options = {}) {
    const { ocrMode = 'fast', maxPages = 50, scale = 2.0, onProgress } = options;

    const pdfjs = getPdfjs();
    const dataBuffer = fs.readFileSync(filePath);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(dataBuffer) }).promise;
    const totalPages = Math.min(pdf.numPages, maxPages);

    const engineName = ocrMode === 'fast' ? '百度云OCR' : 'Tesseract.js';
    console.log(`[OCR] PDF共${pdf.numPages}页，将处理前${totalPages}页（${engineName}）`);

    const pageTexts = [];

    // 根据模式选择引擎
    if (ocrMode === 'fast') {
      // 百度云OCR
      for (let i = 1; i <= totalPages; i++) {
        if (onProgress) onProgress(i, totalPages);

        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          const { Canvas } = require('@napi-rs/canvas');
          const canvas = new Canvas(Math.round(viewport.width), Math.round(viewport.height));

          await page.render({
            viewport,
            canvasContext: canvas.getContext('2d'),
            intent: 'print',
          }).promise;

          const pngBuffer = canvas.toBuffer('image/png');
          const base64Image = pngBuffer.toString('base64');

          const pageText = await this._recognizeByBaidu(base64Image);
          pageTexts.push(pageText);

          console.log(`[OCR] 第${i}/${totalPages}页识别完成，${pageText.length}字符`);
        } catch (error) {
          console.error(`[OCR] 第${i}页处理失败:`, error.message);
          pageTexts.push('');
        }
      }
    } else {
      // Tesseract.js
      const worker = await this._getTesseractWorker();

      for (let i = 1; i <= totalPages; i++) {
        if (onProgress) onProgress(i, totalPages);

        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });

          const { Canvas } = require('@napi-rs/canvas');
          const canvas = new Canvas(Math.round(viewport.width), Math.round(viewport.height));

          await page.render({
            viewport,
            canvasContext: canvas.getContext('2d'),
            intent: 'print',
          }).promise;

          const pngBuffer = canvas.toBuffer('image/png');

          console.log(`[OCR] 正在识别第${i}页...`);
          const result = await worker.recognize(pngBuffer);
          const pageText = result.data.text || '';

          pageTexts.push(pageText);
          console.log(`[OCR] 第${i}/${totalPages}页识别完成，${pageText.length}字符`);
        } catch (error) {
          console.error(`[OCR] 第${i}页处理失败:`, error.message);
          pageTexts.push('');
        }
      }
    }

    // 合并所有页面文本
    let finalText = '';
    for (let i = 0; i < pageTexts.length; i++) {
      const t = pageTexts[i];
      if (t.trim()) {
        finalText += `\n--- 第${i + 1}页 ---\n${t}\n`;
      }
    }

    return {
      text: finalText.trim(),
      pageCount: totalPages,
      ocrUsed: true,
      ocrMode,
    };
  }

  // ============================================
  // 百度云OCR
  // ============================================

  async _getBaiduAccessToken() {
    if (this.baiduAccessToken && Date.now() < this.baiduTokenExpireTime) {
      return this.baiduAccessToken;
    }

    if (!this.baiduApiKey || !this.baiduSecretKey) {
      throw new Error(
        '未配置百度云OCR凭证。请在.env文件中设置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY\n' +
        '申请地址: https://cloud.baidu.com/product/ocr (通用文字识别每天500次免费)'
      );
    }

    const tokenUrl = `${BAIDU_OCR_ENDPOINT}/oauth/2.0/token` +
      `?grant_type=client_credentials` +
      `&client_id=${this.baiduApiKey}` +
      `&client_secret=${this.baiduSecretKey}`;

    console.log('[OCR] 正在获取百度云 access token...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.access_token) {
      this.baiduAccessToken = data.access_token;
      this.baiduTokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
      console.log('[OCR] 百度云 access token 获取成功');
      return this.baiduAccessToken;
    } else {
      throw new Error(`获取 access token 失败: ${JSON.stringify(data)}`);
    }
  }

  async _recognizeByBaidu(base64Image) {
    const token = await this._getBaiduAccessToken();
    const ocrUrl = `${BAIDU_OCR_ENDPOINT}/rest/2.0/ocr/v1/general_basic?access_token=${token}`;

    const response = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64Image)}`,
    });

    const data = await response.json();

    if (data.words_result) {
      return data.words_result.map((item) => item.words).join('\n');
    }
    return '';
  }

  // ============================================
  // Tesseract.js
  // ============================================

  async _getTesseractWorker() {
    if (!tesseractWorker) {
      const { createWorker } = require('tesseract.js');
      const langPath = path.resolve(__dirname, '../../tesseract-data');

      tesseractWorker = await createWorker('chi_sim+eng', 1, {
        langPath,
        gzip: false,
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // 进度日志
          }
        },
      });
      console.log('[OCR] Tesseract.js 初始化完成，语言: chi_sim+eng');
    }
    return tesseractWorker;
  }
}

module.exports = new OcrService();
