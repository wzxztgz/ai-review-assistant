/**
 * Prompt 构建服务 (Prompt V4.0)
 *
 * 功能：
 * - 根据PRD的Prompt V4.0规范构建完整的复习分析prompt
 * - 支持不同资料类型（真题、PPT、笔记）的差异化prompt
 * - 支持不同详细程度（简洁、标准、详细）
 * - 支持用户自定义补充说明
 * - 系统角色定义和行为约束
 */

const typeDetector = require('./typeDetector');

/**
 * 系统角色定义
 */
const SYSTEM_ROLE = `你是一位专业的AI课程复习助手，擅长分析各类课程资料（真题、PPT讲义、课堂笔记等），帮助学生高效复习。

你的核心能力：
1. 从课程资料中精准提取知识点和关键内容
2. 按优先级组织复习内容，帮助学生合理分配时间
3. 生成结构化的复习文档，便于快速查阅
4. 识别核心重点和易错点，提供针对性的复习建议

你必须遵循以下规则：
- 所有回复必须以JSON格式返回
- 严格按照指定的JSON结构输出
- 内容必须基于提供的资料，不得编造
- 如果资料不足，在对应字段中说明
- 使用中文输出所有内容`;

/**
 * 详细程度配置
 */
const DETAIL_LEVELS = {
  concise: {
    label: '简洁模式',
    description: '只保留最核心的知识点和关键信息，适合快速浏览',
    maxKnowledgePoints: 15,
    maxExamPoints: 10,
    exampleDepth: 'minimal',
  },
  normal: {
    label: '标准模式',
    description: '平衡详细度和简洁性，适合常规复习',
    maxKnowledgePoints: 30,
    maxExamPoints: 20,
    exampleDepth: 'moderate',
  },
  detailed: {
    label: '详细模式',
    description: '全面覆盖所有知识点，适合深度复习',
    maxKnowledgePoints: 50,
    maxExamPoints: 30,
    exampleDepth: 'comprehensive',
  },
};

class PromptBuilderService {
  constructor() {
    this.systemRole = SYSTEM_ROLE;
    this.detailLevels = DETAIL_LEVELS;
  }

  /**
   * 构建完整的分析Prompt
   * @param {object} params - 参数
   * @param {Array<{text: string, originalName: string, type: string}>} params.parsedFiles - 已解析的文件列表
   * @param {object} params.config - 用户配置
   * @param {string} params.config.courseName - 课程名称
   * @param {string} params.config.examDate - 考试日期
   * @param {string} params.config.priorityMode - 优先级模式
   * @param {string} params.config.detailLevel - 详细程度
   * @param {string} params.config.customPrompt - 自定义补充说明
   * @returns {{systemMessage: string, userMessage: string}}
   */
  build(params) {
    const { parsedFiles, config = {} } = params;

    const detailLevel = this.detailLevels[config.detailLevel] || this.detailLevels.normal;

    // 构建系统消息
    const systemMessage = this._buildSystemMessage(config);

    // 构建用户消息
    const userMessage = this._buildUserMessage(parsedFiles, config, detailLevel);

    return { systemMessage, userMessage };
  }

  /**
   * 构建系统消息
   */
  _buildSystemMessage(config) {
    let systemMessage = this.systemRole;

    // 根据优先级模式添加额外指令
    if (config.priorityMode === 'emergency') {
      systemMessage += `\n\n当前为【急救模式】，请特别关注：
- 优先提取最核心、最重要的知识点
- 急救文档应控制在2000字以内
- 每个知识点配一个最简洁的记忆口诀或关键词
- 明确标注核心重点和关键内容`;
    }

    return systemMessage;
  }

  /**
   * 构建用户消息
   */
  _buildUserMessage(parsedFiles, config, detailLevel) {
    const parts = [];

    // 提取资料类型列表（包含unknown，用于判断是否有真题）
    const allTypes = parsedFiles.map(f => f.type);
    const materialTypes = [...new Set(allTypes)];
    const hasExam = materialTypes.includes('exam');
    const hasPpt = materialTypes.includes('ppt');
    const hasNotes = materialTypes.includes('notes');
    const onlyUnknown = materialTypes.length === 1 && materialTypes[0] === 'unknown';

    // 根据置信度判断资料类型可靠性
    const examFiles = parsedFiles.filter(f => f.type === 'exam');
    const hasHighConfidenceExam = examFiles.some(f => f.confidence > 0.7);
    const hasLowConfidenceExam = examFiles.some(f => f.confidence <= 0.7 && f.confidence > 0);
    const hasUserConfirmedExam = examFiles.some(f => f.confidence === 1.0 && !f.autoDetected);

    // 1. 任务描述（传入置信度信息）
    parts.push(this._buildTaskDescription(config, detailLevel, materialTypes, {
      hasHighConfidenceExam,
      hasLowConfidenceExam,
      hasUserConfirmedExam
    }));

    // 2. 资料内容
    parts.push(this._buildMaterialContent(parsedFiles));

    // 3. 输出格式要求
    parts.push(this._buildOutputFormat(detailLevel, materialTypes, { hasExam, hasPpt, hasNotes, onlyUnknown }));

    // 4. 用户自定义补充
    if (config.customPrompt) {
      parts.push(`\n## 用户补充说明\n${config.customPrompt}`);
    }

    return parts.join('\n\n');
  }

  /**
   * 构建任务描述
   */
  _buildTaskDescription(config, detailLevel, materialTypes = [], confidenceInfo = {}) {
    const { hasHighConfidenceExam, hasLowConfidenceExam, hasUserConfirmedExam } = confidenceInfo;
    const courseInfo = config.courseName ? `课程名称：${config.courseName}` : '';
    const examInfo = config.examDate ? `考试日期：${config.examDate}` : '';
    const contextInfo = [courseInfo, examInfo].filter(Boolean).join('\n');

    // 根据资料类型和置信度生成不同的分析策略
    const hasExam = materialTypes.includes('exam');
    const hasPpt = materialTypes.includes('ppt');
    const hasNotes = materialTypes.includes('notes');

    let analysisStrategy = '';
    if (hasExam) {
      if (hasUserConfirmedExam) {
        // 用户明确确认的真题
        analysisStrategy = `
**分析策略（真题驱动-用户确认）**：
- 用户已确认上传的是真题/试卷资料
- 可以基于真题出题频率判断考点优先级
- "必考"：真题中出现3次以上的高频考点
- "重要"：真题中出现1-2次的中频考点
- "建议复习"：真题中未出现但相关的知识点`;
      } else if (hasHighConfidenceExam) {
        // 高置信度自动识别
        analysisStrategy = `
**分析策略（真题驱动-高置信度）**：
- 系统识别为真题/试卷资料（置信度>70%）
- 可以基于真题出题频率判断考点优先级
- "必考"：真题中出现3次以上的高频考点
- "重要"：真题中出现1-2次的中频考点
- "建议复习"：真题中未出现但相关的知识点`;
      } else if (hasLowConfidenceExam) {
        // 低置信度自动识别
        analysisStrategy = `
**分析策略（混合模式-低置信度）**：
- 部分资料被识别为真题但置信度较低（≤70%）
- 建议谨慎使用"必考"等词汇，可标注为"疑似真题"
- 优先基于知识点重要性进行划分
- 如有明确真题特征再使用考试导向标签`;
      }
    } else if (hasPpt || hasNotes) {
      analysisStrategy = `
**分析策略（知识点驱动）**：
- 你只有PPT讲义/笔记，没有真题数据，无法判断"考频"
- 请基于知识点的**重要性**和**基础性**进行优先级划分：
- "核心重点"：课程核心概念、基础原理、常考知识点
- "重要内容"：扩展知识、应用场景、关联概念
- "了解即可"：补充说明、边缘知识、拓展内容
- 注意：不要使用"必考"、"高频"等需要真题数据支撑的表述`;
    }

    return `## 任务描述
请分析以下课程资料，生成完整的复习分析报告。

${contextInfo}

详细程度：${detailLevel.label}（${detailLevel.description}）
- 知识点数量上限：${detailLevel.maxKnowledgePoints}
- 考点数量上限：${detailLevel.maxExamPoints}
- 示例深度：${detailLevel.exampleDepth}
${analysisStrategy}`;
  }

  /**
   * 构建资料内容
   */
  _buildMaterialContent(parsedFiles) {
    const sections = parsedFiles.map((file, index) => {
      const typeLabel = this._getTypeLabel(file.type);
      const textPreview = file.text.length > 15000
        ? file.text.substring(0, 15000) + '\n\n... (内容过长，已截断)'
        : file.text;

      return `### 资料 ${index + 1}：${file.originalName}
- 类型：${typeLabel}
- 页数/长度：${file.pageCount || '未知'}页，${file.text.length}字符

---内容开始---
${textPreview}
---内容结束---`;
    });

    return `## 课程资料\n\n${sections.join('\n\n')}`;
  }

  /**
   * 构建输出格式要求
   */
  _buildOutputFormat(detailLevel, materialTypes = [], typeInfo = {}) {
    const { hasExam, hasPpt, hasNotes, onlyUnknown } = typeInfo;

    // 根据是否有真题，使用不同的优先级标签
    let priorityLabels;
    let priorityConstraint;

    if (hasExam) {
      // 有真题：使用考试导向的标签
      priorityLabels = {
        mustKnow: { label: '必考知识点', desc: '真题高频出现，必须掌握' },
        important: { label: '重要复习点', desc: '真题中频出现，重点复习' },
        review: { label: '了解即可', desc: '真题未考，了解即可' },
      };
      priorityConstraint = '你上传了真题/试卷，可以使用"必考知识点"、"重要复习点"等考试导向的标签。';
    } else if (hasPpt || hasNotes) {
      // 只有PPT/笔记：使用学习导向的标签
      priorityLabels = {
        mustKnow: { label: '核心重点', desc: '课程核心概念，必须掌握' },
        important: { label: '重要内容', desc: '扩展知识，建议深入理解' },
        review: { label: '了解即可', desc: '补充说明，简单了解' },
      };
      priorityConstraint = '【重要】你只上传了PPT讲义/笔记，没有真题数据。禁止使用"必考"、"高频"、"考试重点"等需要真题数据支撑的词汇。必须使用"核心重点"、"重要内容"、"了解即可"等学习导向的标签。';
    } else {
      // 未知类型：保守处理
      priorityLabels = {
        mustKnow: { label: '核心重点', desc: '课程核心概念，必须掌握' },
        important: { label: '重要内容', desc: '扩展知识，建议深入理解' },
        review: { label: '了解即可', desc: '补充说明，简单了解' },
      };
      priorityConstraint = '【重要】无法确定资料类型，未检测到真题。禁止使用"必考"、"高频"等考试导向词汇。使用"核心重点"、"重要内容"、"了解即可"等标签。';
    }

    return `## 输出格式要求

请严格按照以下JSON结构返回，key值必须完全一致：

\`\`\`json
{
  "priorityReport": {
    "summary": "整体复习建议概述（200字以内）",
    "totalKnowledgePoints": 知识点总数,
    "totalKeyPoints": 关键内容总数,
    "estimatedStudyHours": 预估复习时长(小时)",
    "difficulty": "easy|medium|hard",
    "questionTypeDistribution": { "选择题": X, "填空题": Y, "计算题": Z, "简答题": W },
    "priorityLevels": {
      "mustKnow": { "label": "${priorityLabels.mustKnow.label}", "count": 数量, "points": [{"id": "p1", "name": "...", "importance": 1-5}] },
      "important": { "label": "${priorityLabels.important.label}", "count": 数量, "points": [...] },
      "review": { "label": "${priorityLabels.review.label}", "count": 数量, "points": [...] }
    }
  },
  "fullDocument": {
    "title": "...",
    "sections": [{
      "id": "s1",
      "title": "章节标题",
      "knowledgePoints": [{
        "id": "k1",
        "name": "知识点名称",
        "explanation": "详细解释（使用Markdown格式，支持步骤列表、表格、公式高亮）",
        "keyPoints": ["关键要点1", "关键要点2"],
        "formulas": ["重要公式或数字约束，如 C=2Hlog₂L"],
        "source": "来自 xxx.pdf 第X页",
        "examInfo": ${hasExam ? `{
          "frequency": "高频|中频|低频|未考",
          "examMethod": "考法说明，如：大题，给定数据计算CRC冗余码",
          "questions": [
            { "question": "题目原文", "type": "选择题|计算题|简答题", "score": 分值, "source": "2022期末试卷" }
          ]
        }` : 'null'}
      }]
    }]
  },
  "emergencyDocument": { "title": "...", "content": "...", "mustRemember": [...], "quickReview": "...", "tips": [...] },
  "metadata": { "courseName": "...", "analyzedAt": "...", "materialTypes": [...], "totalChars": 数字, "confidence": 0-1, "warnings": [] },
  "qualityAssessment": { "overallConfidence": 0-1, "completeness": 0-1, "accuracy": 0-1, "issues": ["自评发现的问题"] }
}
\`\`\`

**知识点解释要求（根据详细程度）**：
- 当前详细程度：${detailLevel.label}
${this._getExplanationGuide(detailLevel, hasExam)}

**解释格式要求**：
1. **流程性知识点**（如协议工作流程）：使用编号步骤列表（1. xxx 2. xxx 3. xxx）
2. **对比性知识点**（如RIP vs OSPF）：必须使用Markdown表格对比
3. **格式性知识点**（如MAC帧格式）：使用 \`|\` 分隔展示各字段
4. **公式和关键数字**：单独列出，用 \`公式\` 标记
5. **每个知识点控制在3-8行**，信息密度高但不冗余

**优先级标签约束**：
${priorityConstraint}

**硬约束（必须严格遵守）**：
1. **禁止编造**：所有内容必须基于用户上传的资料，如果资料中没有某个知识点，不要自行补充
2. **保持客观**：不要添加"我认为"、"我觉得"等主观表述
3. **明确来源**：每个知识点必须在source字段标注来源文件名（如"来自 5网络层-2.pdf 第5页"），多份资料时必须区分
4. **格式优先**：Markdown格式必须正确，标题层级清晰
5. **长度控制**：fullDocument不超过15000字符，emergencyDocument不超过2000字符
6. **数据缺失处理**：如果资料中没有的信息，对应字段填 null 或空数组
7. **warnings规范**：不要在 metadata.warnings 中写入JSON格式的内容
8. **标签规范**：没有真题时绝对禁止使用"必考"、"高频"、"考试重点"等词汇
9. **ID格式**：所有ID使用英文小写+数字的格式（如 p1, k1, s1）
${hasExam ? `10. **真题题目**：examInfo.questions中的题目必须从真题原文中摘录，不得编造或改写题目内容` : ''}`;
  }

  /**
   * 根据详细程度生成解释指南
   */
  _getExplanationGuide(detailLevel, hasExam) {
    const guides = {
      concise: {
        explanation: '- 解释要求：一句话定义（30-50字），只保留核心概念\n- keyPoints：2-3个最关键的要点\n- formulas：仅列出最重要的公式',
        exam: hasExam ? '- examInfo.frequency：标注频率\n- examInfo.examMethod：一句话说明考法' : '',
      },
      normal: {
        explanation: '- 解释要求：定义 + 原理 + 关键要点（100-200字），使用步骤列表\n- keyPoints：3-5个要点，包含关键约束\n- formulas：列出所有重要公式和数字约束',
        exam: hasExam ? '- examInfo.frequency：标注频率\n- examInfo.examMethod：说明考法和题型\n- examInfo.questions：列出1-2道典型题目' : '',
      },
      detailed: {
        explanation: '- 解释要求：定义 + 原理步骤 + 示例 + 易错点 + 关联知识（200-400字）\n- keyPoints：5-8个要点，包含关键约束和注意事项\n- formulas：列出所有公式，标注含义和适用条件',
        exam: hasExam ? '- examInfo.frequency：标注频率\n- examInfo.examMethod：详细说明考法、解题思路\n- examInfo.questions：列出所有相关题目，标注来源试卷和分值' : '',
      },
    };

    const guide = guides[detailLevel.value] || guides.normal;
    return guide.explanation + (guide.exam ? '\n' + guide.exam : '');
  }

  /**
   * 获取资料类型的中文标签
   */
  _getTypeLabel(type) {
    const labels = {
      [typeDetector.types.EXAM]: '真题/试卷',
      [typeDetector.types.PPT]: 'PPT讲义/课件',
      [typeDetector.types.NOTES]: '课堂笔记',
      [typeDetector.types.UNKNOWN]: '未知类型',
    };
    return labels[type] || '未知类型';
  }

  /**
   * 构建单步分析的Prompt（用于流水线中的分步调用）
   * @param {string} step - 步骤名称
   * @param {object} params - 步骤参数
   * @returns {{systemMessage: string, userMessage: string}}
   */
  buildStepPrompt(step, params) {
    switch (step) {
      case 'extractExamPoints':
        return this._buildExtractExamPointsPrompt(params);
      case 'extractKnowledge':
        return this._buildExtractKnowledgePrompt(params);
      case 'buildPriority':
        return this._buildPriorityPrompt(params);
      case 'buildEmergency':
        return this._buildEmergencyPrompt(params);
      default:
        throw new Error(`未知的分析步骤: ${step}`);
    }
  }

  /**
   * 考点提取Prompt
   */
  _buildExtractExamPointsPrompt(params) {
    return {
      systemMessage: `你是一位专业的考试分析专家，擅长从课程资料中提取考点。
请分析提供的资料，提取所有可能的考点，并评估每个考点的出题频率和重要性。
返回JSON格式的考点列表。`,
      userMessage: `请从以下资料中提取考点：

${params.text}

返回格式：
\`\`\`json
{
  "examPoints": [
    {
      "name": "考点名称",
      "frequency": "high|medium|low",
      "importance": 1-5,
      "source": "来自哪个资料",
      "keyContent": "核心内容",
      "possibleQuestionTypes": ["选择题", "简答题"],
      "relatedKnowledge": ["关联知识点"]
    }
  ]
}
\`\`\``,
    };
  }

  /**
   * 知识点提取Prompt
   */
  _buildExtractKnowledgePrompt(params) {
    return {
      systemMessage: `你是一位专业的教育内容分析师，擅长从课程资料中梳理知识体系。
请分析提供的资料，提取完整的知识体系，按章节/模块组织。
返回JSON格式的知识结构。`,
      userMessage: `请从以下资料中提取知识体系：

${params.text}

返回格式：
\`\`\`json
{
  "sections": [
    {
      "title": "章节标题",
      "knowledgePoints": [
        {
          "name": "知识点名称",
          "explanation": "详细解释",
          "keyPoints": ["关键要点"],
          "examples": ["示例"],
          "difficulty": "easy|medium|hard"
        }
      ]
    }
  ]
}
\`\`\``,
    };
  }

  /**
   * 优先级报告Prompt
   */
  _buildPriorityPrompt(params) {
    return {
      systemMessage: `你是一位资深的课程辅导专家，擅长帮助学生制定复习优先级。
根据提取的知识点，生成优先级报告。`,
      userMessage: `根据以下知识点，生成复习优先级报告：

知识点列表：
${JSON.stringify(params.examPoints, null, 2)}

知识体系：
${JSON.stringify(params.knowledgeSections, null, 2)}

${params.courseName ? `课程：${params.courseName}` : ''}

返回格式：
\`\`\`json
{
  "summary": "整体复习建议",
  "estimatedStudyHours": 数字,
  "difficulty": "easy|medium|hard",
  "mustKnow": ["核心重点列表"],
  "important": ["重要内容列表"],
  "review": ["建议了解列表"]
}
\`\`\``,
    };
  }

  /**
   * 急救文档Prompt
   */
  _buildEmergencyPrompt(params) {
    return {
      systemMessage: `你是一位高效的考前复习专家。
根据分析结果，生成一份精简的考前急救文档，帮助学生快速复习最核心的内容。
文档应控制在2000字以内，使用Markdown格式。`,
      userMessage: `根据以下分析结果，生成考前急救文档：

核心重点：
${JSON.stringify(params.mustKnowPoints, null, 2)}

重要内容：
${JSON.stringify(params.importantPoints, null, 2)}

返回格式：
\`\`\`json
{
  "title": "考前急救文档",
  "content": "Markdown格式的急救复习内容",
  "mustRemember": ["必须记忆的核心要点"],
  "quickReview": "快速复习清单(Markdown)",
  "examTips": ["复习技巧"]
}
\`\`\``,
    };
  }
}

// 导出单例
module.exports = new PromptBuilderService();
