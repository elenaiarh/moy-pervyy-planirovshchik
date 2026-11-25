#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/myplaning.platunova-fin.ru"
LOGIN="${1:-elena}"

read -r -s -p "Новый пароль для ${LOGIN}, минимум 10 символов: " PASSWORD
echo
read -r -s -p "Повтори новый пароль: " PASSWORD_CONFIRM
echo

if [[ "${PASSWORD}" != "${PASSWORD_CONFIRM}" ]]; then
  unset PASSWORD PASSWORD_CONFIRM
  echo "Пароли не совпадают"
  exit 1
fi

if [[ "${#PASSWORD}" -lt 10 ]]; then
  unset PASSWORD PASSWORD_CONFIRM
  echo "Пароль должен быть не короче 10 символов"
  exit 1
fi

printf '%s' "${PASSWORD}" | sudo -u assiya bash -c 'cd "$1" && exec node server/reset-password.js "$2"' _ "${APP_DIR}" "${LOGIN}"
unset PASSWORD PASSWORD_CONFIRM
rm -f /home/elena.ai/ASSIYA-FIRST-LOGIN.txt
echo "Файл со старым временным паролем удалён"
