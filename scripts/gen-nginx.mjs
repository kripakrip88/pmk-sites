// Генерирует deploy/nginx/sites.conf: по server-блоку на каждый домен из sites/*/site.json.
// Кириллические домены → punycode. Статика: /srv/sites/<slug>/, заявки: /api/ → PocketBase.
// Админка PocketBase (/_/) снаружи закрыта — заходить через SSH-туннель.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';

const root = new URL('../', import.meta.url);
const sites = readdirSync(new URL('sites/', root), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => JSON.parse(readFileSync(new URL(`sites/${d.name}/site.json`, root), 'utf8')));

// https включается у сайта, только когда для него уже есть сертификат (том certs docker compose),
// иначе nginx не стартует. Без сертификата сайт отдаётся по http — так открывается прототип.
// TLS=0 — всем только http, TLS=1 — всем https (не проверяя сертификаты).
const CERTS = process.env.CERTS_DIR || '/var/lib/docker/volumes/pmk-sites_certs/_data/live';
const hasTls = (host) => (process.env.TLS === '0' ? false : process.env.TLS === '1' || existsSync(`${CERTS}/${host}/fullchain.pem`));

const block = (s) => {
  const host = domainToASCII(s.domain);
  const cert = `/etc/letsencrypt/live/${host}`;
  const tls = hasTls(host);
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

// Длинные punycode-имена (.рф) не влезают в хеш имён по умолчанию (64).
// Запрос по IP или на чужое имя — сбрасываем, а не отдаём первый попавшийся сайт.
const head = `server_names_hash_bucket_size 128;

server {
    listen 80 default_server;
    listen 443 ssl default_server;
    ssl_reject_handshake on;
    return 444;
}
`;
const out = new URL('deploy/nginx/sites.conf', root);
writeFileSync(out, `# Сгенерировано scripts/gen-nginx.mjs — руками не править.\n\n${head}\n${sites.map(block).join('\n')}`);
const https = sites.filter((s) => hasTls(domainToASCII(s.domain))).map((s) => s.slug);
console.log(`deploy/nginx/sites.conf: ${sites.length} сайт(ов), https: ${https.join(', ') || 'нет'}`);
