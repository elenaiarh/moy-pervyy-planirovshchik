#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/assiya"
PATCH_DIR="/home/elena.ai/assiya-mobile-fix"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/opt/assiya.backups/mobile-fix-${STAMP}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запусти через sudo: sudo bash /home/elena.ai/update-mobile-fix.sh"
  exit 1
fi

echo "== Проверяю файлы обновления =="
test -f "${PATCH_DIR}/src/app.js"
test -f "${PATCH_DIR}/src/styles.css"
test -d "${APP_DIR}/src"

echo "== Делаю backup текущих frontend-файлов =="
mkdir -p "${BACKUP_DIR}/src"
cp "${APP_DIR}/src/app.js" "${BACKUP_DIR}/src/app.js"
cp "${APP_DIR}/src/styles.css" "${BACKUP_DIR}/src/styles.css"

echo "== Обновляю мобильные правки =="
cp "${PATCH_DIR}/src/app.js" "${APP_DIR}/src/app.js"
cp "${PATCH_DIR}/src/styles.css" "${APP_DIR}/src/styles.css"
chown assiya:assiya "${APP_DIR}/src/app.js" "${APP_DIR}/src/styles.css"

echo "== Проверяю синтаксис на сервере =="
cd "${APP_DIR}"
runuser -u assiya -- /usr/bin/npm run check

echo "== Перезапускаю приложение =="
systemctl restart assiya
systemctl status assiya --no-pager | sed -n '1,25p'
curl -fsS http://127.0.0.1:3020/health
echo

echo "Готово. Backup старых файлов: ${BACKUP_DIR}"
