#!/usr/bin/env bash
set -euo pipefail

APP_DOMAIN="elenpl.aibotdata.ru"
APP_PORT="3020"
APP_USER="assiya"
APP_GROUP="assiya"
APP_DIR="/var/www/${APP_DOMAIN}"
DATA_DIR="/var/lib/assiya"
UPLOADS_DIR="${DATA_DIR}/uploads"
BACKUP_DIR="/var/backups/assiya"
RELEASE_ARCHIVE="/home/elena.ai/assiya-vps-release.tgz"
SERVICE_FILE="/etc/systemd/system/assiya.service"
NGINX_AVAILABLE="/etc/nginx/sites-available/${APP_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${APP_DOMAIN}"
CRON_FILE="/etc/cron.d/assiya-backup"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти скрипт через sudo"
  exit 1
fi

if [[ ! -f "${RELEASE_ARCHIVE}" ]]; then
  echo "Не найден ${RELEASE_ARCHIVE}"
  exit 1
fi

if ss -lnt | awk '{print $4}' | grep -qE "(^|:)${APP_PORT}$"; then
  echo "Порт ${APP_PORT} уже занят"
  exit 1
fi

getent group "${APP_GROUP}" >/dev/null || addgroup --system "${APP_GROUP}"
id "${APP_USER}" >/dev/null 2>&1 || adduser --system --ingroup "${APP_GROUP}" --home "${APP_DIR}" --no-create-home "${APP_USER}"

mkdir -p "${APP_DIR}" "${UPLOADS_DIR}" "${BACKUP_DIR}"
tar -xzf "${RELEASE_ARCHIVE}" -C "${APP_DIR}"

chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}" "${DATA_DIR}" "${BACKUP_DIR}"
chmod 750 "${APP_DIR}" "${DATA_DIR}" "${UPLOADS_DIR}" "${BACKUP_DIR}"

cd "${APP_DIR}"
sudo -u "${APP_USER}" npm ci --omit=dev

VAPID_KEYS="$(sudo -u "${APP_USER}" node server/generate-vapid.js | grep -E '^ASSIYA_VAPID_(PUBLIC|PRIVATE)_KEY=')"
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
${VAPID_KEYS}
ASSIYA_VAPID_SUBJECT=mailto:admin@${APP_DOMAIN}
ASSIYA_NOTIFICATION_TIMEZONE=Europe/Kirov
ASSIYA_PUSH_INTERVAL_MS=60000
ENV
chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
chmod 640 "${APP_DIR}/.env"

cat > "${SERVICE_FILE}" <<UNIT
[Unit]
Description=ASSIYA private planner
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node server/app.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${DATA_DIR} ${BACKUP_DIR} ${APP_DIR}

[Install]
WantedBy=multi-user.target
UNIT

cat > "${NGINX_AVAILABLE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    client_max_body_size 12m;

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
ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

cat > "${CRON_FILE}" <<CRON
17 3 * * * ${APP_USER} cd ${APP_DIR} && /usr/bin/node server/backup-now.js >> /var/log/assiya-backup.log 2>&1
CRON
chmod 644 "${CRON_FILE}"

systemctl daemon-reload
systemctl enable --now assiya.service
nginx -t
systemctl enable --now nginx.service
systemctl reload nginx.service

curl -fsS "http://127.0.0.1:${APP_PORT}/health"
echo
systemctl is-active assiya.service
systemctl is-active nginx.service
