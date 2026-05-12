/**
 * AI分析流水线
 *
 * 功能：
 * - 串联所有处理环节：文档提取 -> 类型识别 -> 考点提取 -> 知识点拆分 -> 知识组装 -> 文档生成
 * - 支持进度回调（用于流式响应）
 * - 错误处理与恢复
 * - 结果缓存（可选）
 *
 * 流水线步骤：
 * 1. 文档提取（pdfParser）- 从上传文件中提取文本
 * 2. 类型识别（typeDetector）- 判断资料类型
 * 3. AI分析（deepseek + promptBuilder）- 调用AI进行综合分析
 * 4. 结果组装 - 将AI返回的JSON组装为标准格式
 * 5. 元数据生成 - 添加分析元信息
 */

const pdfParser = require('./pdfParser');
const typeDetector = require('./typeDetector');
const deepseek = require('./deepseek');
const promptBuilder = require('./promptBuilder');

class AnalyzePipeline {
  constructor() {
    this.steps = [
      { name: 'extract', label: '文档提取', handler: this._stepExtract.bind(this) },
      { name: 'detect', label: '类型识别', handler: this._stepDetect.bind(this) },
      { name: 'analyze', label: 'AI分析', handler: this._stepAnalyze.bind(this) },
      { name: 'assemble', label: '结果组装', handler: this._stepAssemble.bind(this) },
      { name: 'metadata', label: '元数据生成', handler: this._stepMetadata.bind(this) },
    ];
  }

  /**
   * 运行完整分析流水线
   * @param {Array<{path: string, originalName: string}>} files - 文件列表
   * @param {object} config - 分析配置
   * @param {string} config.courseName - 课程名称
   * @param {string} config.examDate - 考试日期
   * @param {string} config.priorityMode - 优先级模式
   * @param {string} config.detailLevel - 详细程度
   * @param {string} config.customPrompt - 自定义补充
   * @param {string} config.ocrMode - OCR模式: 'fast'(百度云) 或 'slow'(Tesseract)
   * @param {string} config.requestId - 请求ID
   * @param {function} config.onProgress - 进度回调
   * @returns {Promise<object>} 分析结果
   */
  async run(files, config = {}) {
    const { onProgress, requestId, ocrMode = 'fast' } = config;

    // 共享上下文，在各步骤间传递数据
    const context = {
      files,
      config,
      ocrMode,
      requestId: requestId || `pipeline_${Date.now()}`,
      startTime: Date.now(),
      parsedFiles: [],
      typeResults: [],
      aiResult: null,
      finalResult: null,
      warnings: [],
    };

    const totalSteps = this.steps.length;

    try {
      // 依次执行每个步骤
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        const progress = Math.round(((i) / totalSteps) * 100);

        if (onProgress) {
          onProgress(step.name, `正在${step.label}...`, progress);
        }
        console.log(`[${context.requestId}] 步骤 ${i + 1}/${totalSteps}: ${step.label}`);

        await step.handler(context);

        if (onProgress) {
          onProgress(step.name, `${step.label}完成`, Math.round(((i + 1) / totalSteps) * 100));
        }
      }

      console.log(`[${context.requestId}] 分析流水线完成，耗时: ${Date.now() - context.startTime}ms`);
      return context.finalResult;
    } catch (error) {
      console.error(`[${context.requestId}] 分析流水线在步骤 "${this.steps.find(s => true)?.name || 'unknown'}" 失败:`, error);

      // 如果已有部分结果，尝试返回部分结果
      if (context.aiResult) {
        context.warnings.push(`分析未完全完成: ${error.message}`);
        context.finalResult = this._buildPartialResult(context);
        return context.finalResult;
      }

      throw error;
    }
  }

  // ============================================
  // 步骤1: 文档提取
  // ============================================
  async _stepExtract(context) {
    const { files, ocrMode } = context;

    console.log(`[${context.requestId}] OCR模式: ${ocrMode}`);

    const parsedFiles = await pdfParser.parseBatch(files, { ocrMode });

    // 检查是否有解析失败的文件
    const failedFiles = parsedFiles.filter((f) => !f.success);
    if (failedFiles.length > 0) {
      context.warnings.push(
        `${failedFiles.length} 个文件解析失败: ${failedFiles.map((f) => f.originalName).join(', ')}`
      );
    }

    // 检查是否有成功解析的文件
    const successFiles = parsedFiles.filter((f) => f.success);
    if (successFiles.length === 0) {
      const error = new Error('所有文件解析失败，无法进行分析');
      error.code = 'FILE_READ_ERROR';
      throw error;
    }

    // 检查总文本长度
    const totalChars = successFiles.reduce((sum, f) => sum + f.text.length, 0);
    if (totalChars < 50) {
      context.warnings.push('提取的文本内容过少，分析结果可能不准确');
    }

    context.parsedFiles = successFiles;
  }

  // ============================================
  // 步骤2: 类型识别
  // ============================================
  async _stepDetect(context) {
    const { parsedFiles } = context;

    context.typeResults = parsedFiles.map((file) => {
      const result = typeDetector.detect(file.text, file.originalName);
      return {
        originalName: file.originalName,
        ...result,
      };
    });

    // 打印类型识别结果
    for (const result of context.typeResults) {
      console.log(`[类型识别] ${result.originalName} -> ${result.type} (置信度: ${result.confidence})`);
    }

    // 统计资料类型分布
    const typeDistribution = {};
    for (const result of context.typeResults) {
      typeDistribution[result.type] = (typeDistribution[result.type] || 0) + 1;
    }

    console.log(`[类型识别] 类型分布: ${JSON.stringify(typeDistribution)}`);

    // 如果所有文件类型都是unknown，添加警告
    const unknownCount = typeDistribution['unknown'] || 0;
    if (unknownCount === context.typeResults.length) {
      context.warnings.push('无法确定资料类型，将使用通用分析模式');
    }

    context.typeDistribution = typeDistribution;
  }

  // ============================================
  // 步骤3: AI分析
  // ============================================
  async _stepAnalyze(context) {
    const { parsedFiles, config } = context;

    // 为每个文件附加类型信息和置信度
    // 优先使用用户手动选择的类型，其次使用自动识别的类型
    const filesWithType = parsedFiles.map((file, index) => {
      const autoType = context.typeResults[index]?.type || 'unknown';
      const autoConfidence = context.typeResults[index]?.confidence || 0;
      const userType = file.type; // 用户在前端手动选择的类型

      console.log(`[类型选择] ${file.originalName}: userType=${userType}, autoType=${autoType}, confidence=${autoConfidence}`);

      const finalType = (userType && userType !== 'unknown') ? userType : autoType;
      const finalConfidence = (userType && userType !== 'unknown') ? 1.0 : autoConfidence;

      if (userType && userType !== 'unknown' && autoType !== userType) {
        console.log(`[AI分析] ${file.originalName}: 用户选择类型(${userType}) != 自动识别(${autoType})，使用用户选择`);
      }

      return {
        ...file,
        type: finalType,
        confidence: finalConfidence,
        autoDetected: !userType || userType === 'unknown',
      };
    });

    // 构建Prompt
    const { systemMessage, userMessage } = promptBuilder.build({
      parsedFiles: filesWithType,
      config,
    });

    // 打印完整prompt用于调试
    console.log(`\n========== SYSTEM MESSAGE ==========\n${systemMessage}\n====================================\n`);
    console.log(`\n========== USER MESSAGE ==========\n${userMessage}\n====================================\n`);

    // 调用DeepSeek API
    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ];

    console.log(`[${context.requestId}] 发送AI请求，Prompt长度: ${userMessage.length} 字符`);

    const aiResponse = await deepseek.chatJSON(messages, {
      temperature: 0.3,
      maxTokens: 8192,
    });

    context.aiResult = aiResponse;
    context.usage = deepseek.lastUsage || null; // Token用量

    // 打印AI返回的原始内容
    console.log(`\n========== AI RESPONSE ==========\n${JSON.stringify(aiResponse, null, 2)}\n====================================\n`);
  }

  // ============================================
  // 步骤4: 结果组装
  // ============================================
  async _stepAssemble(context) {
    const { aiResult, config } = context;

    // 验证AI返回的数据结构
    const validated = this._validateAIResult(aiResult);

    // 组装最终结果（保留AI返回的所有字段）
    context.finalResult = {
      priorityReport: validated.priorityReport || this._buildEmptyPriorityReport(),
      fullDocument: validated.fullDocument || this._buildEmptyFullDocument(),
      emergencyDocument: validated.emergencyDocument || this._buildEmptyEmergencyDocument(),
      qualityAssessment: validated.qualityAssessment || null,
    };
  }

  // ============================================
  // 步骤5: 元数据生成
  // ============================================
  async _stepMetadata(context) {
    const { finalResult, parsedFiles, typeResults, config, startTime, warnings } = context;

    const totalChars = parsedFiles.reduce((sum, f) => sum + f.text.length, 0);
    const materialTypes = [...new Set(typeResults.map((t) => t.type))];

    // 计算置信度（基于资料完整度和类型识别置信度）
    const avgConfidence = typeResults.length > 0
      ? typeResults.reduce((sum, t) => sum + t.confidence, 0) / typeResults.length
      : 0;
    const textCompleteness = Math.min(totalChars / 10000, 1); // 10000字符以上视为完整
    const confidence = Math.round((avgConfidence * 0.4 + textCompleteness * 0.6) * 100) / 100;

    finalResult.metadata = {
      courseName: config.courseName || '未指定',
      analyzedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      materialTypes,
      materialCount: parsedFiles.length,
      totalChars,
      totalPages: parsedFiles.reduce((sum, f) => sum + (f.pageCount || 0), 0),
      confidence,
      warnings: warnings.length > 0 ? warnings : undefined,
      config: {
        priorityMode: config.priorityMode || 'normal',
        detailLevel: config.detailLevel || 'normal',
      },
    };
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 验证AI返回的数据结构
   * 尽量修复不完整的数据
   */
  _validateAIResult(result) {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const validated = { ...result };

    // 验证 priorityReport
    if (validated.priorityReport) {
      if (!validated.priorityReport.priorityLevels && !validated.priorityReport.mustKnow) {
        // 尝试兼容旧格式
        if (validated.priorityReport.mustKnow || validated.priorityReport.important) {
          validated.priorityReport = this._normalizePriorityReport(validated.priorityReport);
        }
      }
    }

    // 验证 fullDocument
    if (validated.fullDocument && !validated.fullDocument.sections) {
      // 如果没有sections，尝试从其他字段构建
      if (Array.isArray(validated.fullDocument)) {
        validated.fullDocument = { sections: validated.fullDocument };
      }
    }

    return validated;
  }

  /**
   * 规范化优先级报告格式
   */
  _normalizePriorityReport(report) {
    return {
      summary: report.summary || '',
      totalKnowledgePoints: report.totalKnowledgePoints || 0,
      totalExamPoints: report.totalExamPoints || 0,
      estimatedStudyHours: report.estimatedStudyHours || 0,
      difficulty: report.difficulty || 'medium',
      priorityLevels: {
        mustKnow: {
          label: '必考',
          count: (report.mustKnow || []).length,
          points: (report.mustKnow || []).map((p, i) => ({
            id: `p${i + 1}`,
            name: typeof p === 'string' ? p : p.name,
            frequency: 'high',
            importance: 5,
            keyContent: typeof p === 'string' ? p : p.keyContent || '',
          })),
        },
        important: {
          label: '重要',
          count: (report.important || []).length,
          points: (report.important || []).map((p, i) => ({
            id: `p${(report.mustKnow || []).length + i + 1}`,
            name: typeof p === 'string' ? p : p.name,
            frequency: 'medium',
            importance: 3,
            keyContent: typeof p === 'string' ? p : p.keyContent || '',
          })),
        },
        review: {
          label: '建议复习',
          count: (report.review || []).length,
          points: (report.review || []).map((p, i) => ({
            id: `p${(report.mustKnow || []).length + (report.important || []).length + i + 1}`,
            name: typeof p === 'string' ? p : p.name,
            frequency: 'low',
            importance: 1,
            keyContent: typeof p === 'string' ? p : p.keyContent || '',
          })),
        },
      },
    };
  }

  /**
   * 构建空的优先级报告
   */
  _buildEmptyPriorityReport() {
    return {
      summary: '无法生成优先级报告',
      totalKnowledgePoints: 0,
      totalExamPoints: 0,
      estimatedStudyHours: 0,
      difficulty: 'unknown',
      priorityLevels: {
        mustKnow: { label: '必考', count: 0, points: [] },
        important: { label: '重要', count: 0, points: [] },
        review: { label: '建议复习', count: 0, points: [] },
      },
    };
  }

  /**
   * 构建空的完整文档
   */
  _buildEmptyFullDocument() {
    return {
      title: '复习文档',
      sections: [],
      summary: '无法生成完整复习文档',
    };
  }

  /**
   * 构建空的急救文档
   */
  _buildEmptyEmergencyDocument() {
    return {
      title: '考前急救文档',
      content: '无法生成急救文档',
      mustRemember: [],
      quickReview: '',
      examTips: [],
    };
  }

  /**
   * 构建部分结果（当流水线中途失败时）
   */
  _buildPartialResult(context) {
    return {
      priorityReport: this._buildEmptyPriorityReport(),
      fullDocument: this._buildEmptyFullDocument(),
      emergencyDocument: this._buildEmptyEmergencyDocument(),
      metadata: {
        courseName: context.config.courseName || '未指定',
        analyzedAt: new Date().toISOString(),
        processingTime: Date.now() - context.startTime,
        materialTypes: context.typeResults?.map((t) => t.type) || [],
        materialCount: context.parsedFiles?.length || 0,
        totalChars: context.parsedFiles?.reduce((sum, f) => sum + f.text.length, 0) || 0,
        confidence: 0,
        warnings: context.warnings,
        partial: true,
      },
    };
  }

  /**
   * 获取流水线步骤信息（用于调试和展示）
   */
  getSteps() {
    return this.steps.map((s) => ({ name: s.name, label: s.label }));
  }
}

// 导出单例
module.exports = new AnalyzePipeline();
