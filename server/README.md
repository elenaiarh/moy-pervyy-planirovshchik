# Серверная версия АССИИ

Backend-версия планировщика для VPS.

## Локальный запуск

```bash
cp .env.example .env
npm install
npm run create-user -- elena "длинный-пароль"
npm run server
```

По умолчанию сервер слушает:

```text
http://127.0.0.1:3020
```

## VPS-раскладка

Оптимальная раскладка для сервера:

- код: `/var/www/myplaning.platunova-fin.ru`;
- база: `/var/lib/assiya/assiya.sqlite`;
- вложения: `/var/lib/assiya/uploads`;
- backup: `/var/backups/assiya`;
- сервис: `assiya.service`;
- локальный порт: `127.0.0.1:3020`;
- домен: `myplaning.platunova-fin.ru`.

## Безопасность

- Пароль хранится только как bcrypt-hash.
- Сессия хранится в SQLite как hash случайного токена.
- Cookie: `HttpOnly`, `SameSite=Lax`, в production ещё и `Secure`.
- После нескольких ошибочных попыток вход временно ограничивается.
- Все приватные маршруты требуют авторизацию.

## Backup

Ручное создание SQLite backup:

```bash
npm run backup
```

По умолчанию локальные backup-файлы складываются в `data/backups`, а на VPS — в `/var/backups/assiya`.

Серверные endpoint'ы backup доступны только после входа:

- `GET /api/backups` — список backup;
- `POST /api/backups` — создать свежий backup;
- `GET /api/backups/:fileName/download` — скачать backup.

Восстановление на первом этапе выполняется только через SSH при остановленном сервисе.

## Текущий статус

Готово:

- SQLite-схема;
- страница входа;
- login/logout/me API;
- базовая защита от перебора;
- чек-листы;
- вложения;
- сохранение задач в SQLite из интерфейса;
- backup-команда и защищённый backup API;
- systemd unit-шаблон;
- отдельный Nginx-шаблон для `myplaning.platunova-fin.ru`;
- инструкция деплоя с обязательным read-only аудитом VPS.

Развёртывание выполнено на `myplaning.platunova-fin.ru`: Node.js работает через
`assiya.service`, а Nginx проксирует HTTPS на `127.0.0.1:3020`.
