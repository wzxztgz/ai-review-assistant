-- 真题库数据库表结构

-- 真题表：存储用户上传的真题基本信息
CREATE TABLE IF NOT EXISTS exam_papers (
  id VARCHAR(36) PRIMARY KEY,
  file_id VARCHAR(36) NOT NULL,              -- 关联上传文件表
  course_name VARCHAR(100) NOT NULL,         -- 课程名称
  school VARCHAR(100),                       -- 学校（可选）
  year INT,                                  -- 考试年份
  semester VARCHAR(20),                      -- 学期（如：2023-2024-1）
  exam_type VARCHAR(50) DEFAULT '期末',       -- 考试类型（期末/期中/补考）
  
  -- 解析状态
  status ENUM('pending', 'parsing', 'parsed', 'analyzed', 'error') DEFAULT 'pending',
  parsed_content TEXT,                       -- 解析后的完整文本
  question_count INT DEFAULT 0,              -- 题目数量
  
  -- 用户授权信息
  uploader_session VARCHAR(64),              -- 上传者会话ID（匿名）
  share_consent BOOLEAN DEFAULT FALSE,       -- 是否同意共享
  consent_at TIMESTAMP NULL,                 -- 同意时间
  
  -- 使用统计
  download_count INT DEFAULT 0,              -- 被下载次数
  reference_count INT DEFAULT 0,             -- 被引用次数
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_course_school (course_name, school),
  INDEX idx_year (year),
  INDEX idx_status (status),
  INDEX idx_share_consent (share_consent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题目表：存储解析后的具体题目
CREATE TABLE IF NOT EXISTS exam_questions (
  id VARCHAR(36) PRIMARY KEY,
  exam_paper_id VARCHAR(36) NOT NULL,
  
  -- 题目基本信息
  question_number VARCHAR(20),               -- 题号（如：一、1.）
  question_type ENUM('选择', '填空', '判断', '简答', '计算', '综合', '未知') DEFAULT '未知',
  content TEXT NOT NULL,                     -- 题目内容
  answer TEXT,                               -- 答案（如果有）
  score DECIMAL(5,2),                        -- 分值
  
  -- AI分析结果
  chapter VARCHAR(100),                      -- 所属章节
  knowledge_point VARCHAR(200),              -- 知识点
  difficulty ENUM('易', '中', '难', '未知') DEFAULT '未知',
  
  -- 关联统计
  reference_count INT DEFAULT 0,             -- 被引用次数
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
  INDEX idx_knowledge_point (knowledge_point),
  INDEX idx_chapter (chapter),
  INDEX idx_question_type (question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 考点统计表：跨真题的考点分析
CREATE TABLE IF NOT EXISTS knowledge_point_stats (
  id VARCHAR(36) PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL,
  school VARCHAR(100),                       -- NULL表示跨学校统计
  knowledge_point VARCHAR(200) NOT NULL,     -- 知识点名称
  chapter VARCHAR(100),                      -- 所属章节
  
  -- 统计字段
  total_occurrences INT DEFAULT 0,           -- 总出现次数
  exam_paper_count INT DEFAULT 0,            -- 出现在多少份试卷中
  
  -- 题型分布
  choice_count INT DEFAULT 0,
  fill_count INT DEFAULT 0,
  calc_count INT DEFAULT 0,
  essay_count INT DEFAULT 0,
  
  -- 分值统计
  total_score DECIMAL(10,2) DEFAULT 0,
  avg_score DECIMAL(5,2) DEFAULT 0,
  
  -- 时间分布
  first_exam_year INT,                       -- 首次考察年份
  last_exam_year INT,                        -- 最近考察年份
  
  -- 预测字段
  prediction_score DECIMAL(5,2) DEFAULT 0,   -- 预测得分（0-100）
  prediction_level ENUM('必考', '高频', '中频', '低频', '未考') DEFAULT '未考',
  
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_course_kp (course_name, school, knowledge_point),
  INDEX idx_prediction_level (prediction_level),
  INDEX idx_chapter (chapter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户授权记录表（匿名）
CREATE TABLE IF NOT EXISTS user_consent_logs (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,           -- 会话ID（匿名标识）
  exam_paper_id VARCHAR(36) NOT NULL,
  
  consent_type ENUM('share_exam', 'download_exam'),  -- 授权类型
  consent_value BOOLEAN NOT NULL,            -- 是否同意
  
  ip_hash VARCHAR(64),                       -- IP哈希（用于防刷）
  user_agent_hash VARCHAR(64),               -- UA哈希
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 积分记录表（简单版）
CREATE TABLE IF NOT EXISTS user_points (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,           -- 会话ID
  total_points INT DEFAULT 0,                -- 总积分
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_transactions (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  
  transaction_type VARCHAR(50) NOT NULL,     -- 类型：upload_exam, share_exam, download_exam等
  points INT NOT NULL,                       -- 积分变动（正数为获得，负数为消耗）
  description VARCHAR(200),                  -- 描述
  
  related_exam_id VARCHAR(36),               -- 关联的真题ID
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_session (session_id),
  INDEX idx_type (transaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
