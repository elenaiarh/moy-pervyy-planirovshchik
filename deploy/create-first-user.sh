#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/elenpl.aibotdata.ru"
CREDENTIALS_FILE="/home/elena.ai/ASSIYA-FIRST-LOGIN.txt"

USER_COUNT="$(sudo -u assiya bash -c "cd '${APP_DIR}' && node --input-type=module -e 'import { db } from \"./server/database.js\"; process.stdout.write(String(db.prepare(\"SELECT COUNT(*) AS count FROM users\").get().count));'")"

if [[ "${USER_COUNT}" != "0" ]]; then
  echo "Пользователь приложения уже существует"
  exit 0
fi

TEMP_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
sudo -u assiya bash -c 'cd "$1" && npm run create-user -- "$2" "$3" >/dev/null' _ "${APP_DIR}" "elena" "${TEMP_PASSWORD}"

umask 077
printf 'Адрес: https://elenpl.aibotdata.ru\nЛогин: elena\nПароль: %s\n' "${TEMP_PASSWORD}" > "${CREDENTIALS_FILE}"
unset TEMP_PASSWORD

echo "Пользователь elena создан"
echo "Данные входа сохранены в ${CREDENTIALS_FILE} с правами 600"
