// Собирает все сайты из sites/* (кроме начинающихся с «_») в dist/<slug>/.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const only = process.argv.slice(2);
const slugs = readdirSync(new URL('../sites/', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .filter((s) => !only.length || only.includes(s));

for (const slug of slugs) {
  console.log(`\n=== ${slug} ===`);
  execFileSync('npx', ['astro', 'build'], { stdio: 'inherit', env: { ...process.env, SITE: slug } });
}
