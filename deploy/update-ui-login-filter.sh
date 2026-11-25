#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/assiya"
PATCH_DIR="/home/elena.ai/assiya-ui-login-filter"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/opt/assiya.backups/ui-login-filter-${STAMP}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/update-ui-login-filter.sh"
  exit 1
fi

echo "== Проверяю файлы обновления =="
test -f "${PATCH_DIR}/src/app.js"
test -f "${PATCH_DIR}/src/styles.css"
test -f "${PATCH_DIR}/server/app.js"
test -f "${PATCH_DIR}/index.html"
test -f "${PATCH_DIR}/manifest.webmanifest"

echo "== Делаю backup текущих файлов =="
mkdir -p "${BACKUP_DIR}/src" "${BACKUP_DIR}/server"
cp "${APP_DIR}/src/app.js" "${BACKUP_DIR}/src/app.js"
cp "${APP_DIR}/src/styles.css" "${BACKUP_DIR}/src/styles.css"
cp "${APP_DIR}/server/app.js" "${BACKUP_DIR}/server/app.js"
cp "${APP_DIR}/index.html" "${BACKUP_DIR}/index.html"
cp "${APP_DIR}/manifest.webmanifest" "${BACKUP_DIR}/manifest.webmanifest"

echo "== Обновляю интерфейс и форму входа =="
cp "${PATCH_DIR}/src/app.js" "${APP_DIR}/src/app.js"
cp "${PATCH_DIR}/src/styles.css" "${APP_DIR}/src/styles.css"
cp "${PATCH_DIR}/server/app.js" "${APP_DIR}/server/app.js"
cp "${PATCH_DIR}/index.html" "${APP_DIR}/index.html"
cp "${PATCH_DIR}/manifest.webmanifest" "${APP_DIR}/manifest.webmanifest"
chown assiya:assiya \
  "${APP_DIR}/src/app.js" \
  "${APP_DIR}/src/styles.css" \
  "${APP_DIR}/server/app.js" \
  "${APP_DIR}/index.html" \
  "${APP_DIR}/manifest.webmanifest"

echo "== Проверяю синтаксис на сервере =="
cd "${APP_DIR}"
runuser -u assiya -- /usr/bin/npm run check

echo "== Перезапускаю приложение =="
systemctl restart assiya
systemctl status assiya --no-pager | sed -n '1,25p'
curl -fsS http://127.0.0.1:3020/health
echo

echo "Готово. Backup старых файлов: ${BACKUP_DIR}"
