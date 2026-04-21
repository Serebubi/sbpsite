# PROJECT_CONTEXT.md

## Общий контекст

Проект сейчас состоит из двух частей:

1. `Сарма Экспресс` — новая публичная оболочка сайта с landing-подходом.
2. `SUPERBOX` — основное приложение, где живут прикладные сценарии пользователя.

Их не нужно механически смешивать. На текущем этапе `Сарма Экспресс` выступает как:

- главная витрина,
- набор дополнительных страниц в том же стиле,
- меню-переходник в нужные `SUPERBOX flow`.

## Техническая структура

### Frontend

- `frontend/` — Next.js App Router, React, TypeScript, Tailwind.

Ключевые routes:

- `frontend/app/page.tsx` — главная `Сарма Экспресс`
- `frontend/app/sarma-express/page.tsx` — та же главная отдельным route
- `frontend/app/calculator/page.tsx` — страница калькулятора
- `frontend/app/pickup-points/page.tsx` — страница пунктов выдачи
- `frontend/app/superbox/page.tsx` — приложение `SUPERBOX`

Ключевые компоненты новой публичной части:

- `frontend/components/sarma-express-page.tsx`
- `frontend/components/sarma-express-header.tsx`
- `frontend/components/delivery-calculator-page.tsx`
- `frontend/components/pickup-points-page.tsx`

Ключевой компонент `SUPERBOX`:

- `frontend/components/superbox-app.tsx`

### Backend

- `backend/` — Express + TypeScript.
- Заказы и заявки: `backend/src/routes/orders.ts`, `backend/src/services/order-service.ts`
- Bitrix: `backend/src/services/bitrix-service.ts`

### Shared

- `shared/` — типы, схемы и общие значения.
- Ключевой файл: `shared/src/index.ts`

## Текущая карта маршрутов

### Публичные страницы `Сарма Экспресс`

- `/`
- `/sarma-express`
- `/calculator`
- `/pickup-points`

### Приложение `SUPERBOX`

- `/superbox`

### Переходы в конкретные экраны `SUPERBOX`

- `/superbox?flow=order_lookup`
- `/superbox?flow=pickup_paid`
- `/superbox?flow=pickup_standard`
- `/superbox?flow=ship_russia`
- `/superbox?flow=tariffs`

## Текущая логика верхней навигации

Верхнее меню публичной части — это не просто якоря, а уже рабочие точки входа:

- `Калькулятор` открывает отдельную страницу калькулятора
- `Отслеживание` открывает `SUPERBOX order_lookup`
- `Бизнесу` открывает `SUPERBOX tariffs`
- `Доставка из интернет-магазинов` открывает `SUPERBOX pickup_paid`
- `Отправления в РФ` открывает `SUPERBOX ship_russia`
- `Пункты выдачи` открывает отдельную страницу с картой

Это важная архитектурная договоренность. Если пользователь просит «чтобы кнопка X вела туда-то», сначала стоит продолжать именно этот паттерн.

## Состояние страниц `Сарма Экспресс`

### Главная страница

Компонент:

- `frontend/components/sarma-express-page.tsx`

Содержит:

- синий hero с фоном грузовика,
- крупный заголовок,
- CTA-кнопки,
- блок преимуществ,
- блок услуг.

### Страница калькулятора

Компонент:

- `frontend/components/delivery-calculator-page.tsx`

Содержит:

- отдельный маршрут,
- визуальную форму калькулятора,
- пока только интерфейс без настоящей тарифной логики.

### Страница пунктов выдачи

Компонент:

- `frontend/components/pickup-points-page.tsx`

Содержит:

- адресный список,
- поиск по адресам,
- карту Яндекс Карт,
- выбор точки из списка,
- показ активной метки на карте.

## Яндекс Карты

Текущее подключение:

- через Yandex Maps JS API
- ключ ожидается в `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`
- локально ключ лежит в `frontend/.env.local`

Практическая деталь:

- карта локально уже отрисовывается,
- точки отображаются,
- координаты текущих точек захардкожены в компоненте,
- при этом есть предупреждение Яндекса про `Invalid API key`

Вывод для следующего агента:

- если карта перестанет работать, первым делом смотреть env и валидность ключа,
- не пытаться сразу переписывать карту на другой сервис.

## Бренд и ассеты

### Активно используемые бренд-ассеты

- `frontend/public/brand/hero-background.png`
- `frontend/public/brand/sarma-express-logo-header-final.png`
- `frontend/public/brand/sarma-express-logo-cropped.png`

### Карточки услуг

- `frontend/public/services/express-delivery.png`
- `frontend/public/services/ltl-cargo.png`
- `frontend/public/services/ftl-full-load.png`
- `frontend/public/services/internet-delivery.png`

### Исходники пользователя, которые не трогать без просьбы

- `Сарма экспресс лого .png`
- `фон.png`
- папка `кнопки/`

## Важные архитектурные замечания

### 1. Не путать роли двух частей

Сейчас:

- `Сарма Экспресс` = публичная оболочка и маркетинговые страницы
- `SUPERBOX` = прикладные flows

### 2. Если задача про публичный UI, backend обычно трогать не нужно

В backend/shared есть активные незавершенные изменения. Они не относятся к большинству локальных задач по шапке, страницам и переходам.

### 3. Если задача про новую кнопку или пункт меню

Сначала проверить, можно ли переиспользовать уже существующий `SUPERBOX flow`.

Это дешевле и ближе к текущей логике проекта, чем строить новый экран.

## Стилистическая рамка

### Для `Сарма Экспресс`

- максимально близко к референсам пользователя,
- без лишней самодеятельности,
- белая округлая верхняя плашка,
- яркий синий hero,
- крупная типографика,
- аккуратные белые/полупрозрачные панели.

### Для `SUPERBOX`

- сохранять существующий premium-gradient стиль,
- не переписывать его целиком,
- делать только точечные правки, если пользователь явно просит.

## Практический порядок работы для следующего агента

1. Прочитать `AGENT.md`, `CURRENT_STATUS.md`, `HANDOFF.md`.
2. Проверить `git status --short`.
3. Понять, задача про:
   - публичную часть,
   - `SUPERBOX`,
   - или про связку между ними.
4. Если задача про шапку, навигацию, размер плашки, активные ссылки:
   - идти в `frontend/components/sarma-express-header.tsx`
5. Если задача про публичную страницу:
   - идти в соответствующий компонент страницы
6. Если задача про открытие конкретного сценария в `SUPERBOX`:
   - искать и переиспользовать существующий `flow`
