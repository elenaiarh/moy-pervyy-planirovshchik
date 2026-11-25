#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/assiya"
PATCH_DIR="/home/elena.ai/assiya-pwa-fix"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/opt/assiya.backups/pwa-fix-${STAMP}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/update-pwa-fix.sh"
  exit 1
fi

echo "== Проверяю файлы обновления =="
test -f "${PATCH_DIR}/index.html"
test -f "${PATCH_DIR}/manifest.webmanifest"
test -f "${PATCH_DIR}/server/app.js"

echo "== Делаю backup текущих файлов =="
mkdir -p "${BACKUP_DIR}/server"
cp "${APP_DIR}/index.html" "${BACKUP_DIR}/index.html"
cp "${APP_DIR}/manifest.webmanifest" "${BACKUP_DIR}/manifest.webmanifest"
cp "${APP_DIR}/server/app.js" "${BACKUP_DIR}/server/app.js"

echo "== Обновляю PWA-файлы =="
cp "${PATCH_DIR}/index.html" "${APP_DIR}/index.html"
cp "${PATCH_DIR}/manifest.webmanifest" "${APP_DIR}/manifest.webmanifest"
cp "${PATCH_DIR}/server/app.js" "${APP_DIR}/server/app.js"
chown assiya:assiya "${APP_DIR}/index.html" "${APP_DIR}/manifest.webmanifest" "${APP_DIR}/server/app.js"

echo "== Проверяю синтаксис на сервере =="
cd "${APP_DIR}"
runuser -u assiya -- /usr/bin/npm run check

echo "== Перезапускаю приложение =="
systemctl restart assiya
systemctl status assiya --no-pager | sed -n '1,25p'
curl -fsS http://127.0.0.1:3020/health
echo

echo "Готово. Backup старых файлов: ${BACKUP_DIR}"
