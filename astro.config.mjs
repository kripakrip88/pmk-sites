// Один проект — много сайтов. Какой собирать, задаёт переменная SITE:
//   SITE=lazernaya-rezka npm run build   → dist/lazernaya-rezka/
// Всё, что видно глазами (дизайн, вёрстка, шрифты, тексты), лежит в sites/<SITE>/ —
// у каждого сайта свой уникальный дизайн. В коде папка сайта доступна как '@site/...'.
// Общий код в src/ — только невидимое: SEO-разметка, форма заявки, цели Метрики.
import { defineConfig } from 'astro/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { domainToASCII } from 'node:url';

const slug = process.env.SITE || 'lazernaya-rezka';
const siteDir = fileURLToPath(new URL(`./sites/${slug}/`, import.meta.url));
if (!existsSync(siteDir)) throw new Error(`Нет сайта sites/${slug}/`);
const site = JSON.parse(readFileSync(`${siteDir}site.json`, 'utf8'));

export default defineConfig({
  site: `https://${domainToASCII(site.domain)}`,
  outDir: `./dist/${slug}`,
  publicDir: `${siteDir}public`,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  vite: { resolve: { alias: { '@site': siteDir } } },
});
