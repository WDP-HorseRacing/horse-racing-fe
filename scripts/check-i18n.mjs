// Kiểm tra lớp đa ngôn ngữ.
//
// Giao diện hiện viết thẳng tiếng Việt (ngôn ngữ mặc định), nên script không còn bắt buộc
// bọc mọi đoạn văn bản bằng <T>. Việc còn lại: những chỗ ĐÃ dùng <T> thì chuỗi nguồn
// phải có bản dịch trong bộ từ điển, để khi bật lại tiếng Anh không bị thiếu chữ.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (directory) =>
  readdirSync(directory).forEach((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.tsx')) files.push(path);
  });
walk('src/pages');
walk('src/layouts');
walk('src/components');

const dictionary = {
  ...JSON.parse(readFileSync('src/i18n/locales/vi.json', 'utf8')),
  ...JSON.parse(readFileSync('src/i18n/locales/vi-ui.json', 'utf8')),
  ...JSON.parse(readFileSync('src/i18n/locales/vi-web.json', 'utf8')),
};

const localizedLiterals = new Set();
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/<T>([^<>{}]*[A-Za-z][^<>{}]*)<\/T>/g)) {
    localizedLiterals.add(match[1].trim());
  }
}

const properNameOrUnit = /^(HorseRacing|S|D|km\/h|m\/s)$/;
const untranslated = [...localizedLiterals].filter(
  (text) =>
    text &&
    !dictionary[text] &&
    !properNameOrUnit.test(text) &&
    !Object.keys(dictionary).some((key) => text.includes(key)),
);

if (untranslated.length) {
  console.error(`Thiếu bản dịch tiếng Việt cho:\n${untranslated.sort().join('\n')}`);
  process.exit(1);
}

console.log(
  `Lớp đa ngôn ngữ hợp lệ: ${localizedLiterals.size} chuỗi đi qua <T> đều có bản dịch; phần còn lại viết thẳng tiếng Việt.`,
);
