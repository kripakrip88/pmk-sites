# Деплой на VPS

**Сервер:** Beget VPS «Robust Caelum», IP `45.9.41.92`, Ubuntu 26.04, 1 ГБ RAM + 1 ГБ swap, публичный IPv4.
Вход только по SSH-ключу (`ssh root@45.9.41.92`), пароли в репо не хранить. ERP-сервер не трогаем.

Настраивать из локальной сессии: из облачной сессии Claude порт 22 недоступен.

## 0. Ключ (один раз, на своём компьютере)

```bash
[ -f ~/.ssh/id_ed25519.pub ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -q
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@45.9.41.92
```

Затем на сервере отключить вход по паролю и сменить пароль root (`passwd`).
Файл `50-cloud-init.conf` включает пароль, а в sshd побеждает первое значение — поэтому
запрет кладём в файл, который читается раньше:

```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' \
  > /etc/ssh/sshd_config.d/01-pmk-hardening.conf
sshd -t && systemctl reload ssh && sshd -T | grep passwordauthentication   # → no
```

## 1. Сервер

```bash
# swap: без него сборка на 1 ГБ RAM может упасть
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
apt update && apt install -y docker.io docker-compose-v2 git nodejs npm
git clone https://github.com/kripakrip88/pmk-sites.git /opt/pmk-sites   # репо публичное
cd /opt/pmk-sites && cp .env.example .env   # заполнить; LEADS_EMAIL= пусто — письма не шлём
```

## 2. DNS (панель Beget)

Для каждого домена: A-запись `@` и `www` → `45.9.41.92`. Подождать, пока обновится
(`dig +short лазерная-резка-хабаровск.рф`).

## 3. Первый запуск (без SSL)

```bash
npm ci && npm run build:all
npm run nginx                # https только у сайтов с сертификатом, остальные — по http
docker compose up -d --build
```

## 4. Сертификаты

```bash
for d in $(node -e "const fs=require('fs'),u=require('url');for(const s of fs.readdirSync('sites'))if(!s.startsWith('_'))console.log(u.domainToASCII(JSON.parse(fs.readFileSync('sites/'+s+'/site.json')).domain))"); do
  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $d -d www.$d --agree-tos -m pmkpark@mail.ru -n
done
npm run nginx && docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

`gen-nginx` сам включает https у сайта, когда в томе `pmk-sites_certs` появился его сертификат
(`TLS=0` — всем только http, `TLS=1` — всем https). Запрос по IP сбрасывается (444).

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
