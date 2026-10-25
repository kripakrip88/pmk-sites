# Деплой на VPS

**Сервер:** Beget VPS «Robust Caelum», IP `45.9.41.92`, Ubuntu 24.04, публичный IPv4.
Вход только по SSH-ключу (`ssh root@45.9.41.92`), пароли в репо не хранить. ERP-сервер не трогаем.

Настраивать из локальной сессии: из облачной сессии Claude порт 22 недоступен.
⚠ Схема ещё не проверялась на живом сервере — первый запуск делать вместе.

## 0. Ключ (один раз, на своём компьютере)

```bash
[ -f ~/.ssh/id_ed25519.pub ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -q
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@45.9.41.92
```

Затем на сервере отключить вход по паролю (`PasswordAuthentication no` в
`/etc/ssh/sshd_config.d/`) и сменить пароль root (`passwd`).

## 1. Сервер

```bash
apt update && apt install -y docker.io docker-compose-v2 git nodejs npm
git clone git@github.com:kripakrip88/pmk-sites.git /opt/pmk-sites
cd /opt/pmk-sites && cp .env.example .env   # заполнить
```

## 2. DNS (панель Beget)

Для каждого домена: A-запись `@` и `www` → `45.9.41.92`. Подождать, пока обновится
(`dig +short лазерная-резка-хабаровск.рф`).

## 3. Первый запуск (без SSL)

```bash
npm ci && npm run build:all
TLS=0 npm run nginx          # только http, чтобы Let's Encrypt мог проверить домен
docker compose up -d --build
```

## 4. Сертификаты

```bash
for d in $(node -e "const fs=require('fs'),u=require('url');for(const s of fs.readdirSync('sites'))if(!s.startsWith('_'))console.log(u.domainToASCII(JSON.parse(fs.readFileSync('sites/'+s+'/site.json')).domain))"); do
  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $d -d www.$d --agree-tos -m pmkpark@mail.ru -n
done
npm run nginx && docker compose restart nginx
```

Продление — cron раз в сутки:
`docker compose run --rm certbot renew -q && docker compose exec nginx nginx -s reload`.

## 5. PocketBase

```bash
docker compose exec pocketbase /pb/pocketbase superuser upsert <email> <пароль> --dir=/pb/pb_data
ssh -L 8090:127.0.0.1:8090 <vps>   # админка: http://127.0.0.1:8090/_/
```

В админке: Settings → Mail settings → SMTP (для писем о заявках).

## 6. Обновление сайтов

```bash
git pull && npm ci && npm run build:all && npm run nginx && docker compose restart nginx
```

Проверка: `curl -sI https://<punycode-домен>/` и тестовая заявка с формы.
