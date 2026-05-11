/**
 * DeepSeek API 调用服务
 *
 * 功能：
 * - 封装DeepSeek API请求（兼容OpenAI接口格式）
 * - 支持流式（SSE）和非流式响应
 * - 自动重试机制
 * - 请求超时控制
 * - Token用量统计
 * - 错误处理与分类
 */

const OpenAI = require('openai');

class DeepSeekService {
  constructor() {
    this.client = null;
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxRetries = 3;
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT) || 120000;
    this._initialized = false;
  }

  /**
   * 初始化OpenAI客户端（延迟初始化）
   */
  _init() {
    if (this._initialized) return;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      throw new Error('DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置有效的API Key');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    });

    this._initialized = true;
    console.log(`DeepSeek客户端初始化完成, model: ${this.model}`);
  }

  /**
   * 非流式聊天请求
   * @param {Array<{role: string, content: string}>} messages - 消息列表
   * @param {object} options - 可选参数
   * @param {number} options.temperature - 温度（默认0.3，偏向确定性输出）
   * @param {number} options.maxTokens - 最大token数（默认16384）
   * @param {string} options.model - 模型名称（覆盖默认）
   * @returns {Promise<{content: string, usage: object, model: string}>}
   */
  async chat(messages, options = {}) {
    this._init();

    const {
      temperature = 0.3,
      maxTokens = 16384,
      model = this.model,
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const choice = response.choices[0];
      const content = choice?.message?.content || '';

      return {
        content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: choice?.finish_reason,
      };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 流式聊天请求
   * @param {Array<{role: string, content: string}>} messages - 消息列表
   * @param {function} onChunk - 接收流式数据块的回调 (chunk: string) => void
   * @param {object} options - 可选参数（同chat）
   * @returns {Promise<{usage: object, model: string}>}
   */
  async chatStream(messages, onChunk, options = {}) {
    this._init();

    const {
      temperature = 0.3,
      maxTokens = 16384,
      model = this.model,
    } = options;

    let fullContent = '';

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          if (onChunk) {
            onChunk(delta);
          }
        }
      }

      return {
        content: fullContent,
        usage: {
          // 流式模式下usage可能不可用
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        model,
      };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 带JSON解析的聊天请求
   * 自动解析AI返回的JSON字符串，处理可能的格式问题
   * @param {Array} messages - 消息列表
   * @param {object} options - 可选参数
   * @returns {Promise<object>} 解析后的JSON对象
   */
  async chatJSON(messages, options = {}) {
    const response = await this.chat(messages, options);
    const { content } = response;

    return this._parseJSONResponse(content);
  }

  /**
   * 多模态聊天请求（支持图片输入）
   * 用于OCR等场景，不强制JSON输出格式
   * @param {Array} messages - 消息列表，content可以是字符串或数组（含image_url）
   * @param {object} options - 可选参数
   * @returns {Promise<{content: string, usage: object, model: string}>}
   */
  async chatVision(messages, options = {}) {
    this._init();

    const {
      temperature = 0.1,
      maxTokens = 4096,
      model = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-chat',
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // 多模态请求不强制JSON格式
      });

      const choice = response.choices[0];
      const content = choice?.message?.content || '';

      return {
        content,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finishReason: choice?.finish_reason,
      };
    } catch (error) {
      throw this._handleError(error);
    }
  }

  /**
   * 尝试修复被截断的 JSON
   * 策略：逐步截断到最后一个完整的对象/数组/字符串
   */
  _attemptRepairJSON(jsonStr) {
    // 策略1：找到最后一个完整的 "}," 或 "}" 并截断
    // 从后往前找，尝试逐步缩短
    const tryPositions = [];
    
    // 找所有 "}," 的位置（对象数组中最后一个完整元素）
    const regex = /\},\s*$/g;
    let match;
    while ((match = regex.exec(jsonStr)) !== null) {
      tryPositions.push(match.index + 1); // 保留 "}"
    }
    
    // 找所有 "}," 后跟换行的位置
    const regex2 = /\},\s*\n/g;
    while ((match = regex2.exec(jsonStr)) !== null) {
      tryPositions.push(match.index + 1);
    }
    
    // 按位置从大到小排序（优先保留最多内容）
    tryPositions.sort((a, b) => b - a);
    
    for (const pos of tryPositions) {
      const candidate = jsonStr.substring(0, pos + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }
    
    // 策略2：暴力逐步截断
    for (let i = jsonStr.length - 1; i > jsonStr.length - 500 && i > 0; i--) {
      if (jsonStr[i] === '}' || jsonStr[i] === ']') {
        const candidate = jsonStr.substring(0, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * 解析AI返回的JSON字符串
   * 处理各种格式问题：
   * - 包含markdown代码块标记
   * - 前后有额外文本
   * - JSON被截断、缺失括号/引号/逗号等
   */
  _parseJSONResponse(content) {
    if (!content || !content.trim()) {
      const error = new Error('AI返回内容为空');
      error.code = 'AI_RESPONSE_PARSE_ERROR';
      throw error;
    }

    let jsonStr = content.trim();

    // 步骤1：去掉 ```json ... ``` 包裹
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // 步骤2：提取第一个 { 到最后一个 } 之间的内容（去除前后多余文本）
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    // 步骤3：直接解析
    try {
      return JSON.parse(jsonStr);
    } catch {
      // 继续尝试修复
    }

    // 步骤4：使用 jsonrepair 自动修复（处理截断、缺失括号、引号、逗号等）
    try {
      const { jsonrepair } = require('jsonrepair');
      const repaired = jsonrepair(jsonStr);
      console.warn('[DeepSeek] JSON解析失败，已使用 jsonrepair 自动修复');
      return JSON.parse(repaired);
    } catch (repairError) {
      // jsonrepair 也失败，尝试手动截断修复
      const manualRepaired = this._attemptRepairJSON(jsonStr);
      if (manualRepaired) {
        console.warn('[DeepSeek] jsonrepair修复失败，已使用手动截断修复');
        return manualRepaired;
      }
    }

    // 所有尝试都失败
    const error = new Error(`无法解析AI返回的JSON内容。原始内容前200字符: ${content.substring(0, 200)}`);
    error.code = 'AI_RESPONSE_PARSE_ERROR';
    error.rawContent = content;
    throw error;
  }

  /**
   * 错误处理与分类
   */
  _handleError(error) {
    // OpenAI SDK 错误
    if (error.status) {
      const status = error.status;

      if (status === 401) {
        const err = new Error('DeepSeek API Key 无效或已过期');
        err.code = 'AI_API_ERROR';
        err.statusCode = 502;
        return err;
      }

      if (status === 429) {
        const err = new Error('DeepSeek API 请求频率超限，请稍后重试');
        err.code = 'AI_RATE_LIMIT';
        err.statusCode = 429;
        return err;
      }

      if (status === 500 || status === 502 || status === 503) {
        const err = new Error(`DeepSeek 服务暂时不可用 (${status})`);
        err.code = 'AI_API_ERROR';
        err.statusCode = 502;
        return err;
      }

      if (status === 400) {
        const err = new Error(`DeepSeek API 请求参数错误: ${error.message}`);
        err.code = 'AI_API_ERROR';
        err.statusCode = 400;
        return err;
      }
    }

    // 超时错误
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const err = new Error(`DeepSeek API 请求超时 (${this.timeout}ms)`);
      err.code = 'AI_TIMEOUT';
      err.statusCode = 504;
      return err;
    }

    // 网络错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const err = new Error('无法连接到 DeepSeek API 服务');
      err.code = 'AI_API_ERROR';
      err.statusCode = 502;
      return err;
    }

    // 默认错误包装
    const err = new Error(`DeepSeek API 调用失败: ${error.message}`);
    err.code = 'AI_API_ERROR';
    err.statusCode = 502;
    err.cause = error;
    return err;
  }

  /**
   * 获取服务状态信息
   */
  getStatus() {
    return {
      initialized: this._initialized,
      model: this.model,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      hasApiKey: !!(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here'),
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    };
  }
}

// 导出单例
module.exports = new DeepSeekService();
