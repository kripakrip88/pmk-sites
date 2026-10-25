// Сбор данных по одному сайту конкурента. Запуск:
//   node tools/collect_site.mjs <url> <niche-slug>
// Пишет research/competitors/<niche>/sites/<domain>.json и screenshots/<domain>/*.png
// Правила ТЗ: robots.txt, 1 запрос в 2-3 с, формы не отправляем, ПДн не собираем.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [url, niche] = process.argv.slice(2);
if (!url || !niche) { console.error('usage: collect_site.mjs <url> <niche>'); process.exit(1); }

const domain = new URL(url).hostname.replace(/^www\./, '');
const root = path.resolve('research/competitors', niche);
const shotDir = path.join(root, 'screenshots', domain);
fs.mkdirSync(shotDir, { recursive: true });
fs.mkdirSync(path.join(root, 'sites'), { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const notes = {};
const origin = new URL(url).origin;

async function fetchText(u) {
  try { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); return r.ok ? await r.text() : null; }
  catch { return null; }
}

const robots = await fetchText(origin + '/robots.txt');
const sitemap = await fetchText(origin + '/sitemap.xml');
const sitemapUrls = sitemap ? (sitemap.match(/<loc>/g) || []).length : null;
if (!sitemap) notes.sitemap_urls = 'sitemap.xml не найден по стандартному пути';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await sleep(2500);
await page.screenshot({ path: path.join(shotDir, 'desktop-first.png') });
await page.screenshot({ path: path.join(shotDir, 'desktop-full.png'), fullPage: true });

const data = await page.evaluate(() => {
  const t = s => (document.querySelector(s)?.textContent || '').trim().replace(/\s+/g, ' ');
  const meta = n => document.querySelector(`meta[name="${n}"]`)?.content || '';
  const body = document.body.innerText || '';
  const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap(s => { try { const j = JSON.parse(s.textContent); return [].concat(j['@graph'] || j).map(x => x['@type']).flat(); } catch { return []; } })
    .filter(Boolean);
  const imgs = [...document.images];
  const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
  const hrefs = links.join(' ');
  return {
    title: document.title, description: meta('description'), h1: t('h1'),
    headings: [...document.querySelectorAll('h2,h3')].map(h => ({ level: +h.tagName[1], text: h.textContent.trim().replace(/\s+/g, ' ').slice(0, 160) })),
    canonical: document.querySelector('link[rel=canonical]')?.href || '',
    schema_types: [...new Set(schema)],
    word_count: body.split(/\s+/).filter(Boolean).length,
    internal_links: links.filter(h => h.startsWith(location.origin)).length,
    images: imgs.length, images_without_alt: imgs.filter(i => !i.alt).length,
    messengers: ['wa.me', 't.me', 'max.ru', 'viber'].filter(m => hrefs.includes(m)),
    phone_type: /8[\s-]?800/.test(body) ? '8-800' : /tel:/.test(document.body.innerHTML) ? 'городской/моб.' : '',
    forms: [...document.forms].map(f => ({ fields: [...f.elements].filter(e => e.name && e.type !== 'hidden').map(e => e.name), file_upload: !!f.querySelector('input[type=file]') })),
    has_calc: /калькулятор|рассчитать стоимость|квиз/i.test(body),
    prices_shown: /\d[\d\s]*(₽|руб)/i.test(body),
    price_examples: (body.match(/[^\n]{0,40}\d[\d\s]{1,8}\s?(₽|руб)[^\n]{0,20}/gi) || []).slice(0, 5).map(s => s.trim()),
    cta: [...document.querySelectorAll('a.btn,button,.button,[class*=btn]')].map(b => b.textContent.trim()).filter(x => x && x.length < 40).slice(0, 8),
    nav: [...document.querySelectorAll('nav a')].map(a => a.textContent.trim()).filter(Boolean).slice(0, 20),
    offer: t('h1') + ' ' + (document.querySelector('h1')?.parentElement?.innerText || '').slice(0, 200).replace(/\s+/g, ' '),
    fonts: [...new Set([getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector('h1') || document.body).fontFamily])],
    bg: getComputedStyle(document.body).backgroundColor,
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
const html = await page.content();
const cms = /wp-content/.test(html) ? 'WordPress' : /bitrix/i.test(html) ? '1C-Bitrix' : /tilda/i.test(html) ? 'Tilda' : /opencart/i.test(html) ? 'OpenCart' : null;
if (!cms) notes['passport.cms'] = 'не определена по HTML';
const weight = await page.evaluate(() => Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) / 1024));

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await sleep(2500);
await mp.screenshot({ path: path.join(shotDir, 'mobile-first.png') });
const mobileOverflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await browser.close();

const out = {
  domain, niche, collected_at: new Date().toISOString().slice(0, 10),
  passport: { company: null, address: null, whois_created: null, cms, tech: [], iks: null, indexed_pages: null, traffic_estimate: null },
  serp: [],
  seo: { url, title: data.title, description: data.description, h1: data.h1, headings: data.headings, canonical: data.canonical, schema_types: data.schema_types, word_count: data.word_count, internal_links: data.internal_links, images: data.images, images_without_alt: data.images_without_alt, robots_txt: !!robots, sitemap_urls: sitemapUrls },
  structure: { type: null, sections: data.nav, landing_blocks_order: data.headings.filter(h => h.level === 2).map(h => h.text) },
  commerce: { offer_first_screen: data.offer, usp: [], cta: data.cta, prices: { shown: data.prices_shown, format: null, examples: data.price_examples }, calculator: data.has_calc, forms: data.forms, contacts: { phone_type: data.phone_type, messengers: data.messengers, chat: null, callback: null }, trust: { portfolio_count: null, own_photos: null, equipment: [], certificates: null, reviews: { own: null, yandex_maps: null, '2gis': null } }, terms: { min_order: null, lead_time: null, delivery: null, installation: null } },
  design: { colors: [data.bg], fonts: data.fonts, theme: null, style: null, scores: { modern: null, readability: null, mobile: null } },
  perf: { lighthouse_mobile: null, lcp_s: null, cls: null, page_weight_kb: weight, mobile_overflow: mobileOverflow },
  ads: [], strengths: [], weaknesses: [],
  notes: { ...notes, 'passport.*': 'WHOIS, ИКС, трафик, адрес — ручной/сервисный этап', 'perf.lighthouse_mobile': 'запускать отдельно: npx lighthouse', 'commerce.trust,design.scores,structure.type': 'нужна ручная оценка по скриншотам', serp: 'заполняется из serp.csv' },
};
fs.writeFileSync(path.join(root, 'sites', domain + '.json'), JSON.stringify(out, null, 2));
console.log('ok', domain);
