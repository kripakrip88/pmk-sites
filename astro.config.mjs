// Один проект — много сайтов. Какой собирать, задаёт переменная SITE:
//   SITE=lazernaya-rezka npm run build   → dist/lazernaya-rezka/
// Конфиг и контент сайта лежат в sites/<SITE>/, доступны в коде как '@site/...'.
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
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  vite: { resolve: { alias: { '@site': siteDir } } },
});
