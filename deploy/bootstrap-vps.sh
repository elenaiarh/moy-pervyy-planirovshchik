#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="myplaning.platunova-fin.ru"
APP_PORT="3020"
APP_USER="assiya"
APP_GROUP="assiya"
APP_DIR="/opt/assiya"
DATA_DIR="/var/lib/assiya"
UPLOADS_DIR="/var/lib/assiya/uploads"
BACKUP_DIR="/var/backups/assiya"
RELEASE_ARCHIVE="/home/elena.ai/assiya-vps-release.tgz"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_DOMAIN}"
SERVICE_FILE="/etc/systemd/system/assiya.service"
CRON_FILE="/etc/cron.d/assiya-backup"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти скрипт через sudo: sudo bash /home/elena.ai/bootstrap-assiya.sh"
  exit 1
fi

echo "== АССИЯ: безопасная установка на VPS =="

if [[ ! -f "${RELEASE_ARCHIVE}" ]]; then
  echo "Не найден архив проекта: ${RELEASE_ARCHIVE}"
  exit 1
fi

if [[ -e "${NGINX_AVAILABLE}" || -e "${NGINX_ENABLED}" ]]; then
  echo "Nginx-конфиг для ${APP_DOMAIN} уже существует. Останавливаюсь, чтобы ничего не перезаписать."
  exit 1
fi

if grep -R "server_name .*${APP_DOMAIN}" /etc/nginx/sites-available /etc/nginx/sites-enabled >/dev/null 2>&1; then
  echo "Домен ${APP_DOMAIN} уже найден в Nginx. Останавливаюсь."
  exit 1
fi

if ss -tulpn | grep -q ":${APP_PORT} "; then
  echo "Порт ${APP_PORT} уже занят. Останавливаюсь."
  ss -tulpn | grep ":${APP_PORT} " || true
  exit 1
fi

echo "== Устанавливаю системные зависимости =="
apt-get update
apt-get install -y nodejs npm build-essential python3 make g++

echo "== Готовлю системного пользователя и директории =="
if ! getent group "${APP_GROUP}" >/dev/null; then
  addgroup --system "${APP_GROUP}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  adduser --system --ingroup "${APP_GROUP}" --home "${APP_DIR}" --no-create-home "${APP_USER}"
fi

mkdir -p "${APP_DIR}" "${UPLOADS_DIR}" "${BACKUP_DIR}"

if [[ -n "$(find "${APP_DIR}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  PREVIOUS_DIR="${APP_DIR}.previous.$(date +%Y%m%d-%H%M%S)"
  echo "В ${APP_DIR} уже есть файлы. Переношу их в ${PREVIOUS_DIR}"
  mv "${APP_DIR}" "${PREVIOUS_DIR}"
  mkdir -p "${APP_DIR}"
fi

echo "== Распаковываю приложение =="
tar -xzf "${RELEASE_ARCHIVE}" -C "${APP_DIR}"

cat > "${APP_DIR}/.env" <<ENV
NODE_ENV=production
ASSIYA_HOST=127.0.0.1
ASSIYA_PORT=${APP_PORT}
ASSIYA_DB_PATH=${DATA_DIR}/assiya.sqlite
ASSIYA_UPLOADS_DIR=${UPLOADS_DIR}
ASSIYA_BACKUP_DIR=${BACKUP_DIR}
ASSIYA_BACKUP_KEEP=30
ASSIYA_COOKIE_SECURE=true
ASSIYA_SESSION_DAYS=180
ASSIYA_LOGIN_WINDOW_MINUTES=15
ASSIYA_LOGIN_MAX_FAILURES=5
ENV

chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}" "${DATA_DIR}" "${BACKUP_DIR}"
chmod 750 "${APP_DIR}" "${DATA_DIR}" "${UPLOADS_DIR}" "${BACKUP_DIR}"
chmod 640 "${APP_DIR}/.env"

echo "== Устанавливаю npm-зависимости =="
cd "${APP_DIR}"
sudo -u "${APP_USER}" npm ci --omit=dev

echo "== Создаю пользователя внутри приложения =="
read -r -p "Логин для входа в АССИЮ [elena]: " ASSIYA_LOGIN
ASSIYA_LOGIN="${ASSIYA_LOGIN:-elena}"

while true; do
  read -r -s -p "Пароль для входа в АССИЮ, минимум 10 символов: " ASSIYA_PASSWORD
  echo
  if [[ "${#ASSIYA_PASSWORD}" -ge 10 ]]; then
    break
  fi
  echo "Пароль слишком короткий."
done

sudo -u "${APP_USER}" npm run create-user -- "${ASSIYA_LOGIN}" "${ASSIYA_PASSWORD}"
unset ASSIYA_PASSWORD

echo "== Настраиваю systemd =="
cp "${APP_DIR}/deploy/assiya.service.example" "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable --now assiya
systemctl status assiya --no-pager
curl -fsS "http://127.0.0.1:${APP_PORT}/health"
echo

echo "== Настраиваю ежедневный backup =="
cp "${APP_DIR}/deploy/assiya-backup.cron.example" "${CRON_FILE}"

echo "== Настраиваю отдельный Nginx-конфиг для ${APP_DOMAIN} =="
cp "${APP_DIR}/deploy/nginx.${APP_DOMAIN}.conf.example" "${NGINX_AVAILABLE}"
ln -s "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"
nginx -t
systemctl reload nginx

echo "== Подключаю HTTPS через certbot =="
certbot --nginx -d "${APP_DOMAIN}" --redirect

echo "== Финальная проверка =="
nginx -t
systemctl reload nginx
systemctl restart assiya
curl -fsS "http://127.0.0.1:${APP_PORT}/health"
echo

echo "Готово. Проверь сайт: https://${APP_DOMAIN}"
