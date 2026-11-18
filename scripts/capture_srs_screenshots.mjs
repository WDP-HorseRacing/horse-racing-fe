// Chụp ảnh màn hình cho SRS từ FE chạy local (pnpm dev, cổng 5173) nối API thật.
//
//   node scripts/capture_srs_screenshots.mjs           Chụp hết danh sách trong scripts/srs-shots.mjs
//   node scripts/capture_srs_screenshots.mjs --watch   Chụp xong vẫn mở, mỗi lần lưu srs-shots.mjs thì chụp lại
//
// Mật khẩu chung của các tài khoản demo lấy từ SEED_PASSWORD, thiếu thì hỏi (không hiện chữ). Không ghi vào file.
// Chỉ mở trang và dialog để chụp, không bấm Lưu/Gửi: dữ liệu là của môi trường thật.
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer-core';

const BASE = process.env.FE_URL ?? 'http://localhost:5173';
const OUT = path.resolve('docs/screenshots');
const DEBUG = path.join(OUT, '_debug');
const SHOTS_FILE = path.resolve('scripts/srs-shots.mjs');
const CORE_FILE = path.resolve('scripts/srs-capture-core.mjs');
const WATCH = process.argv.includes('--watch');
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  let password = process.env.SEED_PASSWORD;
  if (!password && process.stdin.isTTY) password = await askHidden('Mật khẩu chung của các tài khoản demo: ');
  if (!password) {
    console.error('Thiếu mật khẩu: đặt SEED_PASSWORD hoặc chạy trong terminal để nhập.');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    headless: true,
    args: ['--no-sandbox', '--lang=vi-VN', '--force-color-profile=srgb'],
  });

  let running = false;
  let pending = false;
  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    try {
      const core = await import(pathToFileURL(CORE_FILE).href + `?t=${Date.now()}`);
      await core.runShots(browser, password);
    } catch (err) {
      console.log('LỖI chung:', err.message);
    }
    running = false;
    if (pending) {
      pending = false;
      run();
    }
  };

  await run();
  if (!WATCH) {
    await browser.close();
    return;
  }
  console.log(`\nĐang theo dõi ${path.relative(process.cwd(), SHOTS_FILE)}. Lưu file để chụp lại, Ctrl+C để thoát.`);
  let timer;
  fs.watch(SHOTS_FILE, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n=== ${new Date().toLocaleTimeString()} chụp lại`);
      run();
    }, 400);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
