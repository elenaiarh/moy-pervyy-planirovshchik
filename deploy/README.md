# Деплой АССИИ на VPS

Эта папка содержит только шаблоны. Они не применяются автоматически.

## 1. Read-only аудит VPS

До любых изменений на сервере выполнить и сохранить вывод:

```bash
hostname
whoami
pwd
lsb_release -a
systemctl status nginx --no-pager
nginx -T
ls -la /etc/nginx/sites-available
ls -la /etc/nginx/sites-enabled
ss -tulpn
systemctl list-units --type=service --state=running
```

Цель аудита:

- понять, есть ли уже конфиг для `myplaning.platunova-fin.ru`;
- увидеть текущие `server_name` всех сайтов;
- проверить, занят ли порт `3020`;
- понять, как на VPS сейчас подключён HTTPS;
- не задеть чужие сайты и сервисы.

## 2. Что нельзя менять без отдельного решения

- чужие файлы в `/etc/nginx/sites-available`;
- чужие symlink в `/etc/nginx/sites-enabled`;
- глобальный `/etc/nginx/nginx.conf`;
- SSL-сертификаты других доменов;
- существующие `systemd`-сервисы;
- директории других проектов;
- firewall/ufw, если он уже настроен.

## 3. Целевая раскладка

```text
/var/www/myplaning.platunova-fin.ru       код приложения
/var/www/myplaning.platunova-fin.ru/.env  production-настройки
/var/lib/assiya/assiya.sqlite  SQLite-база
/var/lib/assiya/uploads        вложения
/var/backups/assiya            SQLite backup
127.0.0.1:3020                 внутренний порт Node.js
myplaning.platunova-fin.ru     внешний домен
```

## 4. Пример команд после аудита

Команды ниже — ориентир, а не слепой скрипт. Перед выполнением сверить реальные пути и конфиги VPS.

```bash
sudo adduser --system --group --home /var/www/myplaning.platunova-fin.ru assiya
sudo mkdir -p /var/www/myplaning.platunova-fin.ru /var/lib/assiya/uploads /var/backups/assiya
sudo chown -R assiya:assiya /var/www/myplaning.platunova-fin.ru /var/lib/assiya /var/backups/assiya
```

Код можно развернуть через архив релиза или `git pull` в
`/var/www/myplaning.platunova-fin.ru`.

```bash
cd /var/www/myplaning.platunova-fin.ru
npm ci
cp .env.example .env
nano .env
npm run create-user -- elena "длинный-надежный-пароль"
```

В `.env` для VPS должны быть такие базовые значения:

```env
NODE_ENV=production
ASSIYA_HOST=127.0.0.1
ASSIYA_PORT=3020
ASSIYA_DB_PATH=/var/lib/assiya/assiya.sqlite
ASSIYA_UPLOADS_DIR=/var/lib/assiya/uploads
ASSIYA_BACKUP_DIR=/var/backups/assiya
ASSIYA_BACKUP_KEEP=30
ASSIYA_COOKIE_SECURE=true
```

## 5. systemd

После проверки путей:

```bash
sudo cp deploy/assiya.service.example /etc/systemd/system/assiya.service
sudo systemctl daemon-reload
sudo systemctl enable --now assiya
sudo systemctl status assiya --no-pager
curl http://127.0.0.1:3020/health
```

## 6. Nginx

Создать отдельный файл только для домена планировщика:

```bash
sudo cp deploy/nginx.myplaning.platunova-fin.ru.conf.example /etc/nginx/sites-available/myplaning.platunova-fin.ru
sudo ln -s /etc/nginx/sites-available/myplaning.platunova-fin.ru /etc/nginx/sites-enabled/myplaning.platunova-fin.ru
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS подключать после проверки текущих сертификатов. Если сертификата нет, можно использовать Certbot только для `myplaning.platunova-fin.ru`.

## 7. Backup

Ручной backup:

```bash
cd /var/www/myplaning.platunova-fin.ru
npm run backup
```

Ежедневный backup:

```bash
sudo cp deploy/assiya-backup.cron.example /etc/cron.d/assiya-backup
```

Приложение также позволяет создать и скачать SQLite backup из интерфейса после входа.

Восстановление на первом этапе делать только через SSH, остановив сервис, чтобы случайно не перезаписать живую базу из браузера.
