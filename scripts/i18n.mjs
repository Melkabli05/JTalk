import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/app/', import.meta.url).pathname;
const CATALOGS = { ar: 'shared/utils/i18n/ar/messages.ts' };

const QUOTED = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
const PATTERNS = [
  new RegExp(`${QUOTED}\\s*\\|\\s*t\\b`, 'g'),
  new RegExp(String.raw`\bmsg\(\s*${QUOTED}`, 'g'),
  new RegExp(String.raw`\.t\(\s*${QUOTED}`, 'g'),
];

function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield path;
  }
}

function usedTexts() {
  const texts = new Set();
  for (const file of sources(ROOT)) {
    if (file.includes('/shared/utils/i18n/')) continue;
    const source = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const [, single, double] of source.matchAll(pattern)) {
        texts.add((single ?? double).replace(/\\(.)/g, '$1'));
      }
    }
  }
  return texts;
}

const used = usedTexts();
let failed = false;
for (const [locale, path] of Object.entries(CATALOGS)) {
  const { messages } = await import(`${ROOT}${path}`);
  const missing = [...used].filter((text) => !(text in messages));
  const unused = Object.keys(messages).filter((text) => !used.has(text));
  for (const [problem, texts] of [
    ['missing', missing],
    ['unused', unused],
  ]) {
    if (texts.length > 0) {
      failed = true;
      console.error(
        `${locale}: ${texts.length} ${problem}\n${texts.map((t) => `  ${t}`).join('\n')}`,
      );
    }
  }
  if (!failed) console.log(`i18n: ${used.size} texts, all translated into ${locale}.`);
}
process.exit(failed ? 1 : 0);
