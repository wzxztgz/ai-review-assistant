/**
 * 导出服务
 * 支持导出 PDF / Word / Markdown 格式的复习报告
 */

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');

class ExportService {
  constructor() {}

  /**
   * 导出报告
   * @param {object} result - 分析结果
   * @param {string} format - 格式: 'docx' | 'markdown'
   * @returns {Promise<{buffer: Buffer, filename: string, contentType: string}>}
   */
  async export(result, format) {
    switch (format) {
      case 'docx':
        return this.exportToDocx(result);
      case 'markdown':
        return this.exportToMarkdown(result);
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 Markdown
   */
  exportToMarkdown(result) {
    const { priorityReport, fullDocument, emergencyDocument, metadata } = result;
    
    let md = `# ${fullDocument?.title || '复习报告'}\n\n`;
    
    // 概览
    md += `## 📊 概览\n\n`;
    md += `- **课程**: ${metadata?.courseName || '未命名'}\n`;
    md += `- **难度**: ${priorityReport?.difficulty === 'easy' ? '简单' : priorityReport?.difficulty === 'medium' ? '中等' : '困难'}\n`;
    md += `- **预估复习时长**: ${priorityReport?.estimatedStudyHours || '-'} 小时\n`;
    md += `- **知识点总数**: ${priorityReport?.totalKnowledgePoints || '-'}\n\n`;
    
    // 题型分布
    if (priorityReport?.questionTypeDistribution) {
      md += `### 题型分布\n\n`;
      const dist = priorityReport.questionTypeDistribution;
      Object.entries(dist).forEach(([type, count]) => {
        md += `- ${type}: ${count}次\n`;
      });
      md += `\n`;
    }
    
    // 优先级统计
    md += `### 优先级分布\n\n`;
    const levels = priorityReport?.priorityLevels;
    if (levels?.mustKnow) {
      md += `- **${levels.mustKnow.label}**: ${levels.mustKnow.count}个\n`;
    }
    if (levels?.important) {
      md += `- **${levels.important.label}**: ${levels.important.count}个\n`;
    }
    if (levels?.review) {
      md += `- **${levels.review.label}**: ${levels.review.count}个\n`;
    }
    md += `\n`;
    
    // 详细内容
    md += `---\n\n`;
    md += `# 📚 详细内容\n\n`;
    
    if (fullDocument?.sections) {
      fullDocument.sections.forEach((section, idx) => {
        md += `## ${idx + 1}. ${section.title}\n\n`;
        
        if (section.knowledgePoints) {
          section.knowledgePoints.forEach((kp, kidx) => {
            md += `### ${idx + 1}.${kidx + 1} ${kp.name}\n\n`;
            
            if (kp.explanation || kp.content) {
              md += `${kp.explanation || kp.content}\n\n`;
            }
            
            if (kp.formulas?.length) {
              md += `**公式/关键约束**: \n`;
              kp.formulas.forEach(f => {
                md += `- \`${f}\`\n`;
              });
              md += `\n`;
            }
            
            if (kp.keyPoints?.length) {
              md += `**关键要点**:\n`;
              kp.keyPoints.forEach(k => {
                md += `- ${k}\n`;
              });
              md += `\n`;
            }
            
            if (kp.examInfo) {
              md += `**考试信息**: \n`;
              md += `- 考频: ${kp.examInfo.frequency || '-'}\n`;
              if (kp.examInfo.examMethod) {
                md += `- 考法: ${kp.examInfo.examMethod}\n`;
              }
              if (kp.examInfo.questions?.length) {
                md += `- 真题: \n`;
                kp.examInfo.questions.forEach((q, qi) => {
                  md += `  ${qi + 1}. [${q.type}] ${q.question} (${q.score}分, ${q.source})\n`;
                });
              }
              md += `\n`;
            }
            
            if (kp.source) {
              md += `*来源: ${kp.source}*\n\n`;
            }
            
            md += `---\n\n`;
          });
        }
      });
    }
    
    // 急救文档
    if (emergencyDocument) {
      md += `# 🚨 急救速记\n\n`;
      md += `${emergencyDocument.content}\n\n`;
      
      if (emergencyDocument.mustRemember?.length) {
        md += `## 必须记忆\n\n`;
        emergencyDocument.mustRemember.forEach(item => {
          md += `- ${item}\n`;
        });
        md += `\n`;
      }
      
      if (emergencyDocument.tips?.length) {
        md += `## 复习技巧\n\n`;
        emergencyDocument.tips.forEach(tip => {
          md += `- ${tip}\n`;
        });
      }
    }
    
    const buffer = Buffer.from(md, 'utf-8');
    return {
      buffer,
      filename: `${metadata?.courseName || '复习报告'}_${new Date().toISOString().slice(0, 10)}.md`,
      contentType: 'text/markdown; charset=utf-8',
    };
  }

  /**
   * 导出为 Word (DOCX)
   */
  async exportToDocx(result) {
    const { priorityReport, fullDocument, emergencyDocument, metadata } = result;
    
    const children = [];
    
    // 标题
    children.push(
      new Paragraph({
        text: fullDocument?.title || '复习报告',
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
      })
    );
    
    // 概览
    children.push(
      new Paragraph({
        text: '📊 概览',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    
    children.push(new Paragraph({ text: `课程: ${metadata?.courseName || '未命名'}` }));
    children.push(new Paragraph({ 
      text: `难度: ${priorityReport?.difficulty === 'easy' ? '简单' : priorityReport?.difficulty === 'medium' ? '中等' : '困难'}` 
    }));
    children.push(new Paragraph({ text: `预估复习时长: ${priorityReport?.estimatedStudyHours || '-'} 小时` }));
    children.push(new Paragraph({ text: `知识点总数: ${priorityReport?.totalKnowledgePoints || '-'}`, spacing: { after: 200 } }));
    
    // 优先级统计
    children.push(
      new Paragraph({
        text: '优先级分布',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    
    const levels = priorityReport?.priorityLevels;
    if (levels?.mustKnow) {
      children.push(new Paragraph({ text: `${levels.mustKnow.label}: ${levels.mustKnow.count}个` }));
    }
    if (levels?.important) {
      children.push(new Paragraph({ text: `${levels.important.label}: ${levels.important.count}个` }));
    }
    if (levels?.review) {
      children.push(new Paragraph({ text: `${levels.review.label}: ${levels.review.count}个`, spacing: { after: 200 } }));
    }
    
    // 详细内容
    children.push(
      new Paragraph({
        text: '📚 详细内容',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    
    if (fullDocument?.sections) {
      fullDocument.sections.forEach((section, idx) => {
        children.push(
          new Paragraph({
            text: `${idx + 1}. ${section.title}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );
        
        if (section.knowledgePoints) {
          section.knowledgePoints.forEach((kp, kidx) => {
            children.push(
              new Paragraph({
                text: `${kp.name}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 },
              })
            );
            
            if (kp.explanation || kp.content) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: kp.explanation || kp.content }),
                  ],
                  spacing: { after: 100 },
                })
              );
            }
            
            if (kp.formulas?.length) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: '公式/关键约束: ', bold: true })],
                  spacing: { before: 100 },
                })
              );
              kp.formulas.forEach(f => {
                children.push(new Paragraph({ text: `• ${f}` }));
              });
            }
            
            if (kp.keyPoints?.length) {
              children.push(
                new Paragraph({
                  children: [new TextRun({ text: '关键要点:', bold: true })],
                  spacing: { before: 100 },
                })
              );
              kp.keyPoints.forEach(k => {
                children.push(new Paragraph({ text: `• ${k}` }));
              });
            }
            
            if (kp.source) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `来源: ${kp.source}`, italics: true, color: '666666' }),
                  ],
                  spacing: { before: 100 },
                })
              );
            }
          });
        }
      });
    }
    
    const doc = new Document({
      sections: [{
        properties: {},
        children,
      }],
    });
    
    const buffer = await Packer.toBuffer(doc);
    
    return {
      buffer,
      filename: `${metadata?.courseName || '复习报告'}_${new Date().toISOString().slice(0, 10)}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}

module.exports = new ExportService();
