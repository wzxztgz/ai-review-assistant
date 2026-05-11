/**
 * MySQL 数据库连接模块
 *
 * 使用连接池管理数据库连接
 * 提供 Promise 化的 query 方法
 */

const mysql = require('mysql2/promise');

let pool = null;

/**
 * 初始化数据库连接池
 */
function initPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_review_assistant',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+08:00',
  });

  // 测试连接
  pool.getConnection()
    .then(conn => {
      console.log('[Database] MySQL 连接成功');
      conn.release();
    })
    .catch(err => {
      console.error('[Database] MySQL 连接失败:', err.message);
      console.error('[Database] 请检查 .env 中的数据库配置');
    });

  return pool;
}

/**
 * 获取连接池（懒初始化）
 */
function getPool() {
  if (!pool) {
    return initPool();
  }
  return pool;
}

/**
 * 执行 SQL 查询
 * @param {string} sql - SQL 语句
 * @param {array} params - 参数
 * @returns {Promise<array>} 查询结果
 */
async function query(sql, params = []) {
  const p = getPool();
  try {
    const [results] = await p.query(sql, params);
    return results;
  } catch (error) {
    console.error('[Database] 查询失败:', sql);
    console.error('[Database] 错误:', error.message);
    throw error;
  }
}

/**
 * 初始化数据库（创建数据库和表）
 */
async function initDatabase() {
  // 先连接 MySQL（不指定数据库）
  const tempPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  });

  const dbName = process.env.DB_NAME || 'ai_review_assistant';

  try {
    // 创建数据库（如果不存在）
    await tempPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` 
       CHARACTER SET utf8mb4 
       COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[Database] 数据库 "${dbName}" 已就绪`);

    // 关闭临时连接池
    await tempPool.end();

    // 初始化连接池（使用新创建的数据库）
    initPool();

    // 创建表
    await createTables();
    console.log('[Database] 表结构初始化完成');
  } catch (error) {
    console.error('[Database] 数据库初始化失败:', error.message);
    await tempPool.end().catch(() => {});
    throw error;
  }
}

/**
 * 创建表结构
 */
async function createTables() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS exam_papers (
      id VARCHAR(36) PRIMARY KEY,
      file_id VARCHAR(36) NOT NULL,
      course_name VARCHAR(100) NOT NULL,
      school VARCHAR(100),
      year INT,
      semester VARCHAR(20),
      exam_type VARCHAR(50) DEFAULT '期末',
      status ENUM('pending', 'parsing', 'parsed', 'analyzed', 'error', 'private') DEFAULT 'pending',
      parsed_content TEXT,
      question_count INT DEFAULT 0,
      uploader_session VARCHAR(64),
      share_consent BOOLEAN DEFAULT FALSE,
      consent_at TIMESTAMP NULL,
      download_count INT DEFAULT 0,
      reference_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_course_school (course_name, school),
      INDEX idx_year (year),
      INDEX idx_status (status),
      INDEX idx_share_consent (share_consent)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS exam_questions (
      id VARCHAR(36) PRIMARY KEY,
      exam_paper_id VARCHAR(36) NOT NULL,
      question_number VARCHAR(20),
      question_type ENUM('选择', '填空', '判断', '简答', '计算', '综合', '未知') DEFAULT '未知',
      content TEXT NOT NULL,
      answer TEXT,
      score DECIMAL(5,2),
      chapter VARCHAR(100),
      knowledge_point VARCHAR(200),
      difficulty ENUM('易', '中', '难', '未知') DEFAULT '未知',
      reference_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
      INDEX idx_knowledge_point (knowledge_point),
      INDEX idx_chapter (chapter),
      INDEX idx_question_type (question_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS knowledge_point_stats (
      id VARCHAR(36) PRIMARY KEY,
      course_name VARCHAR(100) NOT NULL,
      school VARCHAR(100),
      knowledge_point VARCHAR(200) NOT NULL,
      chapter VARCHAR(100),
      total_occurrences INT DEFAULT 0,
      exam_paper_count INT DEFAULT 0,
      choice_count INT DEFAULT 0,
      fill_count INT DEFAULT 0,
      calc_count INT DEFAULT 0,
      essay_count INT DEFAULT 0,
      total_score DECIMAL(10,2) DEFAULT 0,
      avg_score DECIMAL(5,2) DEFAULT 0,
      first_exam_year INT,
      last_exam_year INT,
      prediction_score DECIMAL(5,2) DEFAULT 0,
      prediction_level ENUM('必考', '高频', '中频', '低频', '未考') DEFAULT '未考',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_course_kp (course_name, school, knowledge_point),
      INDEX idx_prediction_level (prediction_level),
      INDEX idx_chapter (chapter)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_consent_logs (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      exam_paper_id VARCHAR(36) NOT NULL,
      consent_type ENUM('share_exam', 'download_exam'),
      consent_value BOOLEAN NOT NULL,
      ip_hash VARCHAR(64),
      user_agent_hash VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_points (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      total_points INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id VARCHAR(36) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      transaction_type VARCHAR(50) NOT NULL,
      points INT NOT NULL,
      description VARCHAR(200),
      related_exam_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session (session_id),
      INDEX idx_type (transaction_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Database] 连接池已关闭');
  }
}

module.exports = {
  initDatabase,
  initPool,
  getPool,
  query,
  closePool,
};
