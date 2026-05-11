/**
 * 资料类型识别服务（规则引擎）
 *
 * 识别规则（按优先级）：
 *
 * 真题 - 高置信度：
 *   包含 "一、选择题" + "二、填空题" + "三、简答题" 等试卷结构
 *
 * 真题 - 中高置信度：
 *   包含关键词：真题、期末试卷、考试、总分、每题
 *
 * 真题 - 中置信度：
 *   包含：得分、评卷人、密封线
 *
 * 课件/PPT - 高置信度：
 *   包含：第X章、目录、本节要点、学习目标
 *
 * 课件/PPT - 中置信度：
 *   页面顶部有PPT标题、底部有页码格式 1/50
 *
 * 笔记 - 中低置信度：
 *   文本块短、频繁出现 • - * 列表符号
 */

const MATERIAL_TYPES = {
  EXAM: 'exam',
  PPT: 'ppt',
  NOTES: 'notes',
  UNKNOWN: 'unknown',
};

// 置信度等级
const CONFIDENCE = {
  HIGH: 0.9,       // 高
  MEDIUM_HIGH: 0.7, // 中高
  MEDIUM: 0.5,     // 中
  MEDIUM_LOW: 0.3, // 中低
};

class TypeDetectorService {
  constructor() {
    this.types = MATERIAL_TYPES;
  }

  /**
   * 识别资料类型
   * @param {string} text - 文件文本内容
   * @param {string} fileName - 文件名（辅助判断）
   * @returns {{type: string, confidence: number, reason: string, matchedRules: Array}}
   */
  detect(text, fileName = '') {
    if (!text || text.trim().length === 0) {
      return { type: MATERIAL_TYPES.UNKNOWN, confidence: 0, reason: '内容为空', matchedRules: [] };
    }

    const searchPool = `${text}\n${fileName}`;
    const matchedRules = [];

    // ============================================
    // 0. 文件名高权重识别（优先判断）
    // ============================================

    // 文件名识别 - 真题（高权重）
    const examFilePatterns = [
      /\d{4}[-~]\d{4}.*?(真题|试卷|期末|考试)/i,  // 2020-2021真题、2020-2021期末试卷
      /(真题|试卷|期末|考试).*?\d{4}/i,           // 真题2020、期末试卷2020
      /20\d{2}[-_]\d{2}.*?(真题|试卷|期末)/i,     // 2020-2021真题、20_21真题
      /(期中|期末|月考|统考|联考).*?(真题|试卷)/i, // 期中真题、期末试卷
      /真题.*?(解析|答案|详解)/i,                 // 真题解析、真题答案
    ];
    for (const pattern of examFilePatterns) {
      if (pattern.test(fileName)) {
        matchedRules.push({ name: '文件名-真题特征', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.HIGH });
        break;
      }
    }

    // 文件名识别 - PPT/课件（高权重）
    const pptFilePatterns = [
      /第[一二三四五六七八九十\d]+[章讲节]/i,      // 第一章、第3章、第5讲
      /[\d一二三四五六七八九十]+[.．、]\s*[^.]{2,20}/, // 1. 课程内容、1.1 概述、三、重点
      /(课件|讲义|PPT|ppt|幻灯片|教案)/i,          // 课件、讲义、PPT
      /(第|ch|chapter)[\s\d一二三四五六七八九十]+/i, // ch1、chapter 2、第3章
    ];
    for (const pattern of pptFilePatterns) {
      if (pattern.test(fileName)) {
        matchedRules.push({ name: '文件名-PPT特征', type: MATERIAL_TYPES.PPT, confidence: CONFIDENCE.HIGH });
        break;
      }
    }

    // ============================================
    // 1. 真题识别（按置信度从高到低）
    // ============================================

    // 真题-高：包含试卷结构 "一、选择题" + "二、填空题" + "三、简答题"
    const examStructPattern = /一[、．.]\s*选择[题]?\s*.*?二[、．.]\s*填空[题]?\s*.*?三[、．.]\s*简答[题]?/s;
    if (examStructPattern.test(searchPool)) {
      matchedRules.push({ name: '试卷结构匹配', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.HIGH });
    }

    // 真题-高：包含 "一、选择题" + "二、判断题" 等其他组合
    const examStructPattern2 = /一[、．.]\s*(选择|判断|填空|简答|论述|计算|名词解释)[题]?\s*.*?二[、．.]\s*(选择|判断|填空|简答|论述|计算|名词解释)[题]?/s;
    if (!matchedRules.length && examStructPattern2.test(searchPool)) {
      matchedRules.push({ name: '试卷结构匹配', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.HIGH });
    }

    // 真题-中高：关键词
    const examKeywordsHigh = ['真题', '期末试卷', '期末考试', '考试', '总分', '每题'];
    const examHighMatches = this._countKeywords(searchPool, examKeywordsHigh);
    if (examHighMatches >= 2) {
      matchedRules.push({ name: '真题关键词(多个)', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.MEDIUM_HIGH });
    } else if (examHighMatches >= 1) {
      matchedRules.push({ name: '真题关键词(单个)', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.MEDIUM });
    }

    // 真题-中：密封线相关
    const examSealKeywords = ['得分', '评卷人', '密\s*封\s*线', '密封线'];
    const examSealMatches = this._countKeywords(searchPool, examSealKeywords);
    if (examSealMatches >= 2) {
      matchedRules.push({ name: '试卷密封线特征', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.MEDIUM });
    }

    // 真题-中：考试元信息
    const examMetaKeywords = ['考试时间', '满分', '阅卷人', '姓名', '学号', '班级', '注意事项', '答题', '闭卷', '开卷'];
    const examMetaMatches = this._countKeywords(searchPool, examMetaKeywords);
    if (examMetaMatches >= 3) {
      matchedRules.push({ name: '考试元信息', type: MATERIAL_TYPES.EXAM, confidence: CONFIDENCE.MEDIUM });
    }

    // ============================================
    // 2. 课件/PPT识别
    // ============================================

    // PPT-高：章节结构 + 教学要素
    const pptHighKeywords = ['第[一二三四五六七八九十百]+\\s*[章讲节部分]', '目录', '本节要点', '学习目标', '教学目标', '重点难点'];
    const pptHighMatches = this._countPatterns(searchPool, pptHighKeywords);
    if (pptHighMatches >= 2) {
      matchedRules.push({ name: 'PPT章节结构+教学要素', type: MATERIAL_TYPES.PPT, confidence: CONFIDENCE.HIGH });
    }

    // PPT-中：页码格式 1/50, 2/50 等
    const pageNumPattern = /\b\d{1,3}\s*\/\s*\d{1,3}\b/g;
    const pageNumMatches = searchPool.match(pageNumPattern);
    if (pageNumMatches && pageNumMatches.length >= 3) {
      // 检查是否是连续页码（如 1/50, 2/50, 3/50）
      const pageNumbers = pageNumMatches.map(m => {
        const parts = m.split('/');
        return { current: parseInt(parts[0]), total: parseInt(parts[1]) };
      });
      const totalPages = pageNumbers[0].total;
      const isConsecutive = pageNumbers.every(p => p.total === totalPages && p.current >= 1 && p.current <= totalPages);
      if (isConsecutive && totalPages >= 5) {
        matchedRules.push({ name: 'PPT页码格式', type: MATERIAL_TYPES.PPT, confidence: CONFIDENCE.MEDIUM });
      }
    }

    // PPT-中：教学内容关键词
    const pptMediumKeywords = ['本章小结', '课后练习', '知识框架', '思维导图', '本章概述', '导入新课', '课堂小结'];
    const pptMediumMatches = this._countKeywords(searchPool, pptMediumKeywords);
    if (pptMediumMatches >= 2) {
      matchedRules.push({ name: 'PPT教学内容特征', type: MATERIAL_TYPES.PPT, confidence: CONFIDENCE.MEDIUM });
    }

    // PPT-低：PPT元信息（文件名中常见）
    const pptLowKeywords = ['PowerPoint', 'PPT', '幻灯片', '讲义', '课件', '演示文稿', 'Slide'];
    const pptLowMatches = this._countKeywords(searchPool, pptLowKeywords);
    if (pptLowMatches >= 1) {
      matchedRules.push({ name: 'PPT元信息', type: MATERIAL_TYPES.PPT, confidence: CONFIDENCE.MEDIUM_LOW });
    }

    // ============================================
    // 3. 笔记识别（最后判断，优先级最低）
    // ============================================

    // 如果文件名已经明确识别为PPT或真题，跳过笔记规则
    const hasFileNameMatch = matchedRules.some(r =>
      r.name.startsWith('文件名-') && (r.type === MATERIAL_TYPES.PPT || r.type === MATERIAL_TYPES.EXAM)
    );

    if (!hasFileNameMatch) {
      // 笔记-中低：频繁出现列表符号 • - *
      const bulletPattern = /[•\-*]\s+/g;
      const bulletMatches = searchPool.match(bulletPattern);
      if (bulletMatches && bulletMatches.length >= 10) {
        // 检查文本块是否较短（笔记特征）
        const lines = text.split('\n').filter(l => l.trim());
        const avgLineLength = text.length / Math.max(lines.length, 1);
        if (avgLineLength < 50) {
          matchedRules.push({ name: '笔记列表符号+短文本块', type: MATERIAL_TYPES.NOTES, confidence: CONFIDENCE.MEDIUM_LOW });
        }
      }

      // 笔记-中低：笔记关键词
      const noteKeywords = ['笔记', '课堂笔记', '学习笔记', '听课笔记', '复习笔记', '手写笔记'];
      const noteMatches = this._countKeywords(searchPool, noteKeywords);
      if (noteMatches >= 1) {
        matchedRules.push({ name: '笔记关键词', type: MATERIAL_TYPES.NOTES, confidence: CONFIDENCE.MEDIUM_LOW });
      }

      // 笔记-低：日期/周次特征
      const noteDatePattern = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]|\d{1,2}月\d{1,2}日|星期[一二三四五六日天]|第[一二三四五六七八九十]+[周次]课/g;
      const noteDateMatches = searchPool.match(noteDatePattern);
      if (noteDateMatches && noteDateMatches.length >= 3) {
        matchedRules.push({ name: '笔记日期特征', type: MATERIAL_TYPES.NOTES, confidence: CONFIDENCE.MEDIUM_LOW });
      }
    }

    // ============================================
    // 汇总结果
    // ============================================

    if (matchedRules.length === 0) {
      return { type: MATERIAL_TYPES.UNKNOWN, confidence: 0, reason: '未匹配到任何规则', matchedRules: [] };
    }

    // 按置信度排序，取最高
    matchedRules.sort((a, b) => b.confidence - a.confidence);
    const best = matchedRules[0];

    // 打印所有匹配结果（调试用）
    for (const rule of matchedRules) {
      console.log(`  [规则匹配] ${rule.name} -> ${rule.type} (置信度: ${rule.confidence})`);
    }

    return {
      type: best.type,
      confidence: best.confidence,
      reason: best.name,
      matchedRules,
    };
  }

  /**
   * 统计关键词出现次数
   */
  _countKeywords(text, keywords) {
    let count = 0;
    for (const kw of keywords) {
      const regex = new RegExp(this._escapeRegex(kw), 'gi');
      const matches = text.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  }

  /**
   * 统计正则模式匹配次数
   */
  _countPatterns(text, patterns) {
    let count = 0;
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  }

  /**
   * 转义正则特殊字符
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 获取所有支持的类型
   */
  getSupportedTypes() {
    return { ...MATERIAL_TYPES };
  }

  /**
   * 获取所有规则（用于调试）
   */
  getRules() {
    return [];
  }
}

module.exports = new TypeDetectorService();
