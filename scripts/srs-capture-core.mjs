// Logic chụp ảnh SRS. capture_srs_screenshots.mjs nạp lại file này mỗi lượt chụp (chế độ --watch),
// nên sửa ở đây không cần khởi động lại script hay nhập lại mật khẩu.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const BASE = process.env.FE_URL ?? 'http://localhost:5173';
const OUT = path.resolve('docs/screenshots');
const DEBUG = path.join(OUT, '_debug');
const SHOTS_FILE = path.resolve('scripts/srs-shots.mjs');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===== Thao tác trên trang ===== */

/** Tìm phần tử hiển thị có chữ khớp `text` (khớp đúng trước, rồi tới chứa). */
async function findByText(page, text, { selector, nth = 0, exact = false } = {}) {
  const handle = await page.evaluateHandle(
    (text, selector, nth, exact) => {
      const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const sels = selector
        ? [selector]
        : ['button, a, [role="tab"], [role="button"], [role="menuitem"], [role="option"], [role="radio"], [role="checkbox"], summary, label', 'li, td, h1, h2, h3, h4, p, span, div'];
      // Ưu tiên hộp thoại đang mở
      const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(visible);
      const roots = dialogs.length ? [dialogs[dialogs.length - 1], document] : [document];
      for (const root of roots) {
        for (const sel of sels) {
          const all = [...root.querySelectorAll(sel)].filter(visible);
          const label = (el) => norm(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title'));
          let hits = all.filter((el) => label(el) === text);
          if (!hits.length && !exact) hits = all.filter((el) => label(el).includes(text));
          // Lấy phần tử sâu nhất để không bấm nhầm khung bao ngoài
          hits = hits.filter((el) => !hits.some((o) => o !== el && el.contains(o)));
          if (hits[nth]) return hits[nth];
        }
      }
      return null;
    },
    text,
    selector ?? null,
    nth,
    exact,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`Không thấy "${text}"`);
  return el;
}

async function runStep(page, step) {
  if (step.goto) {
    await page.goto(BASE + step.goto, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(step.wait ?? 1200);
  } else if (step.click) {
    const el = await findByText(page, step.click, step);
    await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await sleep(150);
    await el.click();
    await sleep(step.wait ?? 900);
  } else if (step.follow) {
    // Đọc href của link chứa chữ rồi mở thẳng (tránh bấm trượt khi thẻ đang chạy hiệu ứng)
    const el = await findByText(page, step.follow, { selector: 'a', ...step });
    const href = await el.evaluate((e) => e.closest('a')?.getAttribute('href'));
    if (!href) throw new Error(`"${step.follow}" không phải link`);
    const url = href.split('?')[0] + (step.query ? `?${step.query}` : '');
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(step.wait ?? 1500);
  } else if (step.clickSel) {
    const el = await page.waitForSelector(step.clickSel, { visible: true, timeout: 8000 });
    await el.click();
    await sleep(step.wait ?? 900);
  } else if (step.type) {
    const el = step.type.sel
      ? await page.waitForSelector(step.type.sel, { visible: true, timeout: 8000 })
      : await page.waitForSelector(`[aria-label="${step.type.label}"], [placeholder="${step.type.label}"]`, { visible: true, timeout: 8000 });
    await el.click({ clickCount: 3 });
    await el.type(step.type.text, { delay: 20 });
    if (step.type.blur) await page.keyboard.press('Tab');
    await sleep(step.wait ?? 500);
  } else if (step.waitText) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: step.timeout ?? 10000 }, step.waitText);
    await sleep(step.wait ?? 300);
  } else if (step.scrollTo) {
    const el = await findByText(page, step.scrollTo, step);
    await el.evaluate((e, block) => e.scrollIntoView({ block }), step.block ?? 'start');
    await page.evaluate((dy) => window.scrollBy(0, dy), step.offset ?? -90);
    await sleep(step.wait ?? 600);
  } else if (step.scroll != null) {
    await page.evaluate((y) => window.scrollTo(0, y), step.scroll);
    await sleep(step.wait ?? 500);
  } else if (step.key) {
    await page.keyboard.press(step.key);
    await sleep(step.wait ?? 400);
  } else if (step.wait) {
    await sleep(step.wait);
  } else if (step.eval) {
    await page.evaluate(step.eval);
    await sleep(300);
  }
}

/* ===== Đăng nhập theo vai trò ===== */
async function loginAs(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  // Form có hiệu ứng xuất hiện và có thể render lại: điền xong phải đọc lại giá trị, chưa đủ thì điền lại.
  let filled = false;
  for (let attempt = 0; attempt < 4 && !filled; attempt++) {
    await sleep(1500);
    for (const [sel, value] of [['input[type="email"]', email], ['input[aria-label="Mật khẩu"]', password]]) {
      const el = await page.waitForSelector(sel, { visible: true });
      await el.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await el.type(value, { delay: 15 });
    }
    await sleep(300);
    filled = await page.evaluate(
      (email, len) => document.querySelector('input[type="email"]')?.value === email && document.querySelector('input[aria-label="Mật khẩu"]')?.value.length === len,
      email,
      password.length,
    );
  }
  if (!filled) throw new Error(`Không điền được form đăng nhập cho ${email} (chưa gửi lên server)`);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null), page.click('button[type="submit"]')]);
  await sleep(2000);
  if (page.url().includes('/login')) {
    const msg = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText ?? '');
    throw new Error(`Đăng nhập ${email} thất bại ${msg}`);
  }
  console.log(`  đăng nhập: ${email}`);
}

async function visibleButtons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a, [role="tab"]')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 60)
      .join(' | '),
  );
}

export async function runShots(browser, password) {
  const mod = await import(pathToFileURL(SHOTS_FILE).href + `?t=${Date.now()}`);
  const only = mod.ONLY?.length ? new Set(mod.ONLY) : null;
  const shots = mod.SHOTS.filter((s) => !only || only.has(s.file));
  fs.mkdirSync(DEBUG, { recursive: true });
  // Mỗi tài khoản một cửa sổ ẩn danh riêng: đăng xuất rồi đăng nhập lại trên cùng trang làm form bị xóa trắng.
  let context = null;
  let page = null;
  let currentUser = null;
  const failed = [];
  const badUsers = new Set();
  let currentVp = null;

  for (const shot of shots) {
    const vpName = shot.viewport ?? 'desktop';
    if (badUsers.has(shot.user)) {
      failed.push(shot.file);
      console.log(`- ${shot.file}: bỏ qua vì ${shot.user} đăng nhập lỗi`);
      continue;
    }
    try {
      if (currentUser !== shot.user) {
        if (context) await context.close().catch(() => null);
        context = await browser.createBrowserContext();
        page = await context.newPage();
        currentVp = null;
        currentUser = null;
      }
      if (currentVp !== vpName) {
        await page.setViewport(VIEWPORTS[vpName]);
        currentVp = vpName;
      }
      if (currentUser !== shot.user) {
        await loginAs(page, shot.user, password);
        currentUser = shot.user;
      }
      console.log(`- ${shot.file}`);
      for (const step of shot.steps) await runStep(page, step);
      await sleep(shot.settle ?? 600);
      const file = path.join(OUT, shot.file);
      if (shot.clip) {
        const el = await findByText(page, shot.clip.text, shot.clip);
        const target = shot.clip.closest ? await el.evaluateHandle((e, s) => e.closest(s) ?? e, shot.clip.closest) : el;
        await target.asElement().screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: !!shot.fullPage });
      }
      console.log(`  ok`);
    } catch (err) {
      failed.push(shot.file);
      if (err.message.includes('Đăng nhập') || err.message.includes('form đăng nhập')) badUsers.add(shot.user);
      console.log(`  LỖI: ${err.message}`);
      console.log(`  url: ${page.url()}`);
      console.log(`  nút đang thấy: ${await visibleButtons(page).catch(() => '')}`);
      await page.screenshot({ path: path.join(DEBUG, shot.file) }).catch(() => null);
      // Đóng dialog đang mở để shot sau không bị kẹt
      await page.keyboard.press('Escape').catch(() => null);
    }
  }
  console.log(`\nXong ${shots.length - failed.length}/${shots.length}.${failed.length ? ' Lỗi: ' + failed.join(', ') : ''}`);
}

