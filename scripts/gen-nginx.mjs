// Генерирует deploy/nginx/sites.conf: по server-блоку на каждый домен из sites/*/site.json.
// Кириллические домены → punycode. Статика: /srv/sites/<slug>/, заявки: /api/ → PocketBase.
// Админка PocketBase (/_/) снаружи закрыта — заходить через SSH-туннель.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';

const root = new URL('../', import.meta.url);
const sites = readdirSync(new URL('sites/', root), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => JSON.parse(readFileSync(new URL(`sites/${d.name}/site.json`, root), 'utf8')));

const block = (s) => {
  const host = domainToASCII(s.domain);
  const cert = `/etc/letsencrypt/live/${host}`;
  // TLS=0 — только http: первый запуск, пока Let's Encrypt не выдал сертификаты.
  // Сайт тогда отдаётся прямо по http, чтобы прототип можно было открыть.
  const tls = process.env.TLS !== '0';
  return `# ${s.domain}
server {
    listen 80;
    server_name ${host} www.${host};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
${tls ? `    location / { return 301 https://${host}$request_uri; }` : `    root /srv/sites/${s.slug};
    include /etc/nginx/snippets/pmk-site.conf;`}
}
${tls ? `server {
    listen 443 ssl;
    http2 on;
    server_name www.${host};
    ssl_certificate ${cert}/fullchain.pem;
    ssl_certificate_key ${cert}/privkey.pem;
    return 301 https://${host}$request_uri;
}
server {
    listen 443 ssl;
    http2 on;
    server_name ${host};
    ssl_certificate ${cert}/fullchain.pem;
    ssl_certificate_key ${cert}/privkey.pem;
    root /srv/sites/${s.slug};
    include /etc/nginx/snippets/pmk-site.conf;
}` : ''}
`;
};

const out = new URL('deploy/nginx/sites.conf', root);
writeFileSync(out, `# Сгенерировано scripts/gen-nginx.mjs — руками не править.\n\n${sites.map(block).join('\n')}`);
console.log(`deploy/nginx/sites.conf: ${sites.length} сайт(ов)`);
