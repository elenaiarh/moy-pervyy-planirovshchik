#!/usr/bin/env bash
set -euo pipefail

DOMAIN="myplaning.platunova-fin.ru"
APP_USER="assiya"
APP_GROUP="assiya"
OLD_DIR="/opt/assiya"
NEW_DIR="/var/www/${DOMAIN}"
ROLLBACK_ROOT="/opt/assiya.backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_DIR="${ROLLBACK_ROOT}/before-var-www-move-${STAMP}"
SERVICE_FILE="/etc/systemd/system/assiya.service"
CRON_FILE="/etc/cron.d/assiya-backup"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/move-assiya-to-var-www.sh"
  exit 1
fi

echo "== Проверяю исходное состояние =="
test -d "${OLD_DIR}"
test -f "${OLD_DIR}/package.json"
test -f "${OLD_DIR}/server/app.js"
id "${APP_USER}" >/dev/null
systemctl is-active --quiet assiya

if [[ -e "${NEW_DIR}" ]]; then
  echo "${NEW_DIR} уже существует. Останавливаюсь, чтобы ничего не перезаписать."
  exit 1
fi

echo "== Проверяю, что остальные продукты активны до переноса =="
systemctl is-active --quiet nginx
systemctl is-active --quiet currency-calculator
systemctl is-active --quiet checking

echo "== Создаю snapshot текущего кода АССИИ =="
mkdir -p "${ROLLBACK_ROOT}"
cp -a "${OLD_DIR}" "${SNAPSHOT_DIR}"

echo "== Останавливаю только assiya.service =="
systemctl stop assiya

echo "== Переношу код в ${NEW_DIR} =="
mkdir -p "${NEW_DIR}"
cp -a "${OLD_DIR}/." "${NEW_DIR}/"
chown -R "${APP_USER}:${APP_GROUP}" "${NEW_DIR}"
chmod 750 "${NEW_DIR}"

echo "== Обновляю assiya.service =="
cat > "${SERVICE_FILE}" <<SERVICE
[Unit]
Description=ASSIYA private planner
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${NEW_DIR}
EnvironmentFile=${NEW_DIR}/.env
ExecStart=/usr/bin/npm run server
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/lib/assiya /var/backups/assiya ${NEW_DIR}

[Install]
WantedBy=multi-user.target
SERVICE

echo "== Обновляю cron backup =="
cat > "${CRON_FILE}" <<CRON
# Ежедневный SQLite backup АССИИ в 03:15.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root cd ${NEW_DIR} && runuser -u ${APP_USER} -- /usr/bin/npm run backup >> /var/log/assiya-backup.log 2>&1
CRON
chmod 644 "${CRON_FILE}"

echo "== Проверяю синтаксис из новой директории =="
cd "${NEW_DIR}"
runuser -u "${APP_USER}" -- /usr/bin/npm run check

echo "== Запускаю АССИЮ из новой директории =="
systemctl daemon-reload
systemctl start assiya
systemctl enable assiya >/dev/null
systemctl status assiya --no-pager | sed -n '1,28p'
curl -fsS http://127.0.0.1:3020/health
echo

echo "== Проверяю Nginx и остальные продукты после переноса =="
nginx -t
systemctl is-active --quiet nginx
systemctl is-active --quiet currency-calculator
systemctl is-active --quiet checking
curl --resolve "${DOMAIN}:443:127.0.0.1" -fsS -o /dev/null -L "https://${DOMAIN}"
curl --resolve "buh.platunova-fin.ru:443:127.0.0.1" -fsS -o /dev/null -L "https://buh.platunova-fin.ru"
curl --resolve "currency.platunova-fin.ru:443:127.0.0.1" -fsS -o /dev/null -L "https://currency.platunova-fin.ru"
curl --resolve "checking.platunova-fin.ru:443:127.0.0.1" -fsS -o /dev/null -L "https://checking.platunova-fin.ru"

echo "Готово."
echo "Новая директория: ${NEW_DIR}"
echo "Старая директория оставлена как rollback-копия: ${OLD_DIR}"
echo "Snapshot до переноса: ${SNAPSHOT_DIR}"
