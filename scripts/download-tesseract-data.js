/**
 * 下载 Tesseract.js 中文语言包
 * 使用 npmmirror 国内镜像
 * 
 * 运行方式: node scripts/download-tesseract-data.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');

const LANG_DATA_DIR = path.resolve(__dirname, '../tesseract-data');

// 语言包列表
const FILES = [
  {
    name: 'chi_sim.traineddata.gz',
    url: 'https://registry.npmmirror.com/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz',
  },
  {
    name: 'eng.traineddata.gz',
    url: 'https://registry.npmmirror.com/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  下载: ${url}`);
    
    const protocol = url.startsWith('https') ? https : http;
    
    const request = (currentUrl) => {
      protocol.get(currentUrl, { timeout: 30000 }, (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`  重定向到: ${response.headers.location}`);
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        response.pipe(file);
        
        let downloaded = 0;
        const total = parseInt(response.headers['content-length'] || '0');
        
        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total > 0) {
            const percent = ((downloaded / total) * 100).toFixed(1);
            process.stdout.write(`  进度: ${percent}%\r`);
          }
        });

        file.on('finish', () => {
          file.close();
          console.log(`  完成: ${dest} (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
          resolve();
        });
      }).on('error', (err) => {
        reject(err);
      });
    };

    request(url);
  });
}

async function main() {
  console.log('========================================');
  console.log('  Tesseract.js 语言包下载工具');
  console.log('========================================\n');

  // 创建目录
  if (!fs.existsSync(LANG_DATA_DIR)) {
    fs.mkdirSync(LANG_DATA_DIR, { recursive: true });
    console.log(`创建目录: ${LANG_DATA_DIR}\n`);
  }

  // 逐个下载
  for (const file of FILES) {
    const dest = path.join(LANG_DATA_DIR, file.name);
    
    if (fs.existsSync(dest)) {
      console.log(`[跳过] ${file.name} 已存在`);
      continue;
    }

    console.log(`\n[下载] ${file.name}`);
    try {
      await downloadFile(file.url, dest);
    } catch (error) {
      console.error(`  失败: ${error.message}`);
      console.log(`  请手动下载: ${file.url}`);
      console.log(`  放到: ${dest}`);
    }
  }

  console.log('\n========================================');
  console.log('  下载完成！');
  console.log('========================================');
}

main().catch(console.error);
