import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = directory => readdirSync(directory).forEach(name => {
  const path = join(directory, name);
  if (statSync(path).isDirectory()) walk(path);
  else if (path.endsWith('.tsx')) files.push(path);
});
walk('src/pages');
const missing = [];
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/<([a-z][\w]*)[^>]*>([^<>{}\n]*[A-Za-z][^<>{}\n]*)<\/\1>/g)) {
    if (!match[2].trim() || match[0].includes('<T>')) continue;
    missing.push(`${path}: ${match[2].trim()}`);
  }
}
if (missing.length) {
  console.error(`Wrap visible text with <T>:\n${missing.join('\n')}`);
  process.exit(1);
}
const dictionary = {
  ...JSON.parse(readFileSync('src/i18n/locales/vi.json', 'utf8')),
  ...JSON.parse(readFileSync('src/i18n/locales/vi-ui.json', 'utf8')),
  ...JSON.parse(readFileSync('src/i18n/locales/vi-web.json', 'utf8')),
};
const localizedLiterals = new Set();
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/<T>([^<>{}]*[A-Za-z][^<>{}]*)<\/T>/g)) localizedLiterals.add(match[1].trim());
}
const properNameOrUnit = /^(HorseRacing|S|D|Mcal \/ day|km\/h)$/;
const untranslated = [...localizedLiterals].filter(text => text && !dictionary[text] && !properNameOrUnit.test(text) && !Object.keys(dictionary).some(key => text.includes(key)));
if (untranslated.length) {
  console.error(`Missing Vietnamese translations:\n${untranslated.sort().join('\n')}`);
  process.exit(1);
}
console.log('All static FE page text uses the localization boundary and locale catalog.');
