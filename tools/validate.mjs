// node tools/validate.mjs <niche> — проверка JSON по схеме ТЗ п.4 и наличия 3 скриншотов
import fs from 'node:fs'; import path from 'node:path';
const niche = process.argv[2]; const root = path.resolve('research/competitors', niche);
const need = ['domain','niche','collected_at','passport','serp','seo','structure','commerce','design','perf','ads','strengths','weaknesses','notes'];
let bad = 0;
for (const f of fs.readdirSync(path.join(root, 'sites'))) {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'sites', f)));
  const miss = need.filter(k => !(k in j));
  const shots = ['desktop-first','mobile-first','desktop-full'].filter(s => !fs.existsSync(path.join(root,'screenshots',j.domain,s+'.png')));
  if (miss.length || shots.length) { bad++; console.log(f, 'нет полей:', miss, 'нет скринов:', shots); }
}
console.log(bad ? `проблем: ${bad}` : 'все JSON валидны');
