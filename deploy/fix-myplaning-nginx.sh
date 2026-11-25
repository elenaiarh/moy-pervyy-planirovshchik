#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="myplaning.platunova-fin.ru"
APP_PORT="3020"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_DOMAIN}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/fix-myplaning-nginx.sh"
  exit 1
fi

echo "== Проверяю, что приложение АССИЯ отвечает локально =="
curl -fsS "http://127.0.0.1:${APP_PORT}/health"
echo

if [[ -e "${NGINX_AVAILABLE}" || -e "${NGINX_ENABLED}" ]]; then
  echo "Конфиг ${APP_DOMAIN} уже существует. Останавливаюсь, чтобы ничего не перезаписать."
  exit 1
fi

if grep -R "server_name .*${APP_DOMAIN}" /etc/nginx/sites-available /etc/nginx/sites-enabled >/dev/null 2>&1; then
  echo "Домен ${APP_DOMAIN} уже найден в Nginx. Останавливаюсь."
  exit 1
fi

echo "== Создаю отдельный Nginx-конфиг только для ${APP_DOMAIN} =="
cat > "${NGINX_AVAILABLE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -s "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

echo "== Проверяю и перезагружаю Nginx =="
nginx -t
systemctl reload nginx

echo "== Выпускаю HTTPS-сертификат Let's Encrypt =="
certbot --nginx \
  -d "${APP_DOMAIN}" \
  --redirect \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive

echo "== Финальная проверка =="
nginx -t
systemctl reload nginx
curl -fsS "https://${APP_DOMAIN}/health" || true

echo "Готово. Проверь: https://${APP_DOMAIN}"
