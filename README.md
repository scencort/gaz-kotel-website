# Gaz-Kotel Website

Многостраничный сайт магазина газовых котлов с полноценным Node.js backend и PostgreSQL.

## Структура

- index.html: главная страница
- catalog.html: каталог товаров
- favorites.html: избранные товары
- product.html: карточка товара
- cart.html: корзина и оформление заказа
- thank-you.html: страница успешного оформления
- admin.html: панель управления заказами
- about.html: страница о компании
- contacts.html: контакты и форма обратной связи
- css/common.css: общая дизайн-система (синий градиент, базовые анимации, header/nav/footer)
- css/index.css: стили главной страницы
- css/catalog.css: стили каталога
- css/about.css: стили страницы о компании
- css/contacts.css: стили страницы контактов
- css/product.css: стили карточки товара
- css/cart.css: стили корзины
- css/favorites.css: стили страницы избранного
- css/thank-you.css: стили страницы подтверждения заказа
- css/admin.css: стили панели заказов
- js/common.js: общая инициализация UI (AOS, активная ссылка в навигации)
- js/products.js: единый источник данных каталога
- js/index.js: логика главной страницы
- js/catalog.js: логика каталога
- js/favorites.js: логика страницы избранного
- js/product.js: логика страницы товара
- js/cart.js: логика корзины и оформления
- js/thank-you.js: логика страницы подтверждения заказа
- js/admin.js: логика админ-панели заказов
- js/contacts.js: логика формы контактов
- js/client.js: генерация/хранение clientId для персональных данных (избранное)
- server.js: HTTP сервер (статические файлы + PostgreSQL API)
- db/schema.sql: схема PostgreSQL (товары, заказы, избранное, отзывы, обращения)
- scripts/db-init.js: инициализация и сидирование базы
- data/products-seed.js: сиды каталога
- package.json: скрипты запуска
- .gitignore: исключения для локальных данных
- .env.example: пример переменных окружения
- deploy/gaz-kotel.service: systemd unit для backend-процесса
- deploy/nginx-gaz-kotel.conf: шаблон Nginx reverse proxy
- images/: изображения товаров и иконок

## Локальный запуск (PostgreSQL)

1. Убедитесь, что установлен Node.js 18+.
2. Убедитесь, что запущен PostgreSQL 14+.
3. Скопируйте `.env.example` в `.env` и заполните `DATABASE_URL`.
4. В корне проекта выполните `npm install`.
5. Инициализируйте БД: `npm run db:init`.
6. Запустите проект: `npm start`.
7. Откройте `http://localhost:3000`.

## Переменные окружения

- `DATABASE_URL`: строка подключения к PostgreSQL
- `DB_AUTO_INIT`: автоинициализация схемы и сидов при старте (`true`/`false`)
- `ADMIN_API_KEY`: ключ защиты админ API (`GET /api/orders`, `PATCH /api/orders/:id/status`)
- `TRUST_PROXY`: использовать `X-Forwarded-For` от Nginx (`true` на проде)
- `RATE_LIMIT_WINDOW_MS`: окно rate limit в миллисекундах
- `RATE_LIMIT_MAX`: максимум запросов в окне для POST `/api/orders`, `/api/contacts`, `/api/reviews`
- `TELEGRAM_BOT_TOKEN`: токен Telegram-бота
- `TELEGRAM_CHAT_ID`: chat id для уведомлений
- `TELEGRAM_NOTIFY_STATUS_CHANGES`: уведомлять ли о смене статуса заказа

## Важные детали

- Данные товаров централизованы в PostgreSQL (`products`), а `js/products.js` используется как fallback при недоступном API.
- catalog.html, product.html и блок популярных товаров на index.html используют единый список, чтобы избежать рассинхрона.
- Повторяющиеся CSS-блоки вынесены из HTML в общие и страничные CSS-файлы.
- Inline-скрипты вынесены из HTML в отдельные JS-файлы по страницам.
- Вкладки приведены к единому визуальному стилю: общий header/footer, одинаковая типографика и компоненты.
- Добавлена синяя градиентная тема и согласованные анимации (фон, карточки, hover, reveal).
- Добавлены плавные переходы между страницами (page transition) для внутренних ссылок.
- Добавлены микро-анимации и визуальная валидация полей форм.
- Добавлено компактное мобильное меню в sticky-header.
- В каталоге добавлены поиск, фильтры и сортировка.
- В каталоге добавлен быстрый просмотр товара (модальное окно).
- Реализовано избранное: кнопки в каталоге + отдельная страница favorites.html.
- Избранное синхронизируется через PostgreSQL API (`/api/favorites`) по `clientId`.
- В cart.html удалена отправка заказа напрямую в Telegram API из браузера.
- Оформление заказа отправляет POST-запрос на `/api/orders` и хранится в PostgreSQL.
- В корзине добавлены промокоды (TEPLO10, GAZ5), расчёт скидки, доставка и итоговый breakdown.
- После успешного заказа выполняется переход на thank-you.html.
- server.js поддерживает чтение заказов и обновление статусов для admin.html из PostgreSQL.
- Админ API можно защитить через `ADMIN_API_KEY` (заголовок `x-admin-key`).
- Контактная форма отправляет обращения в БД (`/api/contacts`).
- На главной странице добавлены блоки отзывов клиентов и FAQ.
- Telegram уведомления отправляются сервером при создании заказа и (опционально) при смене статуса.

## API (основное)

- `GET /api/health` — healthcheck
- `GET /api/products` — список товаров
- `GET /api/products/:id` — карточка товара
- `POST /api/orders` — оформление заказа
- `GET /api/orders` — список заказов (админка)
- `PATCH /api/orders/:orderNumber/status` — смена статуса заказа
- `GET /api/favorites?clientId=...` — список избранного пользователя
- `POST /api/favorites` — добавить в избранное
- `DELETE /api/favorites/:productId?clientId=...` — удалить из избранного
- `POST /api/contacts` — обращения из формы контактов
- `GET /api/reviews` — публичные отзывы
- `POST /api/reviews` — добавить отзыв

## Backend контракт для заказа

cart.html ожидает endpoint:

- URL: /api/orders
- Method: POST
- Content-Type: application/json

Тело запроса:

```json
{
  "orderNumber": 1001,
  "customer": {
    "name": "Иван",
    "phone": "+7...",
    "email": "example@mail.ru",
    "telegram": "@username"
  },
  "items": [
    { "id": "boiler1", "name": "АОГВ-11,6-3", "price": 32000, "quantity": 1 }
  ]
}
```

Если endpoint недоступен, интерфейс покажет сообщение и попытается скопировать детали заказа в буфер обмена.

Дополнительные endpoint для админ-панели:

- URL: /api/orders
- Method: GET
- Ответ: массив заказов (новые сверху)

- URL: /api/orders/:orderNumber/status
- Method: PATCH
- Content-Type: application/json

Тело запроса:

```json
{
  "status": "new"
}
```

Допустимые статусы: `new`, `in-progress`, `completed`.

## Дальнейшие улучшения

- Добавить полноценную роль/авторизацию для `admin.html` (JWT/session).
- Добавить миграции (например, через `node-pg-migrate` или `knex`).
- Добавить автоматические проверки (HTML/CSS lint, smoke/API-тесты).

## Деплой на выделенный сервер (Ubuntu)

1. Установите зависимости:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

1. Клонируйте проект и установите пакеты:

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/scencort/gaz-kotel-website.git
cd gaz-kotel-website
sudo npm install --omit=dev
```

1. Создайте БД и пользователя PostgreSQL:

```bash
sudo -u postgres psql
CREATE DATABASE gaz_kotel;
CREATE USER gaz_user WITH ENCRYPTED PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE gaz_kotel TO gaz_user;
\q
```

1. Создайте `.env` на сервере:

```env
PORT=3000
DATABASE_URL=postgresql://gaz_user:strong_password@localhost:5432/gaz_kotel
DB_AUTO_INIT=true
ADMIN_API_KEY=replace_with_strong_random_key
TRUST_PROXY=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
TELEGRAM_BOT_TOKEN=123456789:your_bot_token
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_NOTIFY_STATUS_CHANGES=true
```

1. Инициализируйте БД:

```bash
cd /var/www/gaz-kotel-website
npm run db:init
```

1. Подключите systemd:

```bash
sudo cp deploy/gaz-kotel.service /etc/systemd/system/gaz-kotel.service
sudo systemctl daemon-reload
sudo systemctl enable gaz-kotel
sudo systemctl restart gaz-kotel
sudo systemctl status gaz-kotel
```

1. Подключите Nginx:

```bash
sudo cp deploy/nginx-gaz-kotel.conf /etc/nginx/sites-available/gaz-kotel
sudo ln -s /etc/nginx/sites-available/gaz-kotel /etc/nginx/sites-enabled/gaz-kotel
sudo nginx -t
sudo systemctl restart nginx
```

1. Включите HTTPS (Certbot):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

1. Откройте порт в firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Проверка Telegram уведомлений

1. Проверьте health endpoint:

```bash
curl -i http://127.0.0.1:3000/api/health
```

1. Создайте тестовый заказ:

```bash
curl -X POST http://127.0.0.1:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": 999001,
    "customer": {
      "name": "Тест Клиент",
      "phone": "+79990000000",
      "email": "test@example.com",
      "telegram": "@test"
    },
    "items": [
      { "id": "boiler1", "name": "АОГВ-11,6-3", "price": 32000, "quantity": 1 }
    ],
    "pricing": {
      "subtotal": 32000,
      "discount": 0,
      "delivery": 0,
      "total": 32000
    }
  }'
```

1. Убедитесь, что:

- заказ появился в PostgreSQL;
- в Telegram пришло сообщение о новом заказе.

1. Просмотр логов сервиса:

```bash
sudo journalctl -u gaz-kotel -f
```
