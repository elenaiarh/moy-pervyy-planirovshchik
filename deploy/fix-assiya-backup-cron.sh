#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/assiya"
CRON_FILE="/etc/cron.d/assiya-backup"
BACKUP_DIR="/var/backups/assiya"
APP_USER="assiya"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/fix-assiya-backup-cron.sh"
  exit 1
fi

echo "== Проверяю приложение и пользователя =="
test -d "${APP_DIR}"
id "${APP_USER}" >/dev/null
test -d "${BACKUP_DIR}"
command -v runuser >/dev/null
command -v npm >/dev/null

echo "== Создаю cron для ежедневного backup =="
cat > "${CRON_FILE}" <<CRON
# Ежедневный SQLite backup АССИИ в 03:15.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root cd ${APP_DIR} && runuser -u ${APP_USER} -- /usr/bin/npm run backup >> /var/log/assiya-backup.log 2>&1
CRON

chmod 644 "${CRON_FILE}"

echo "== Делаю тестовый backup прямо сейчас =="
cd "${APP_DIR}"
runuser -u "${APP_USER}" -- /usr/bin/npm run backup

echo "== Проверяю результат =="
ls -lh "${BACKUP_DIR}" | tail -n 10
echo "Cron установлен: ${CRON_FILE}"
