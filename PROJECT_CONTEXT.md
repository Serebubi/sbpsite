# PROJECT_CONTEXT.md

## Общий контекст

Проект состоит из:

1. `Сарма Экспресс` - публичная витрина и основная визуальная оболочка.
2. `SUPERBOX` - прикладное приложение для заказов, выдачи, отслеживания и тарифов.

Сейчас пользователь последовательно переносит важные `SUPERBOX flow` в визуальный стиль `Сарма Экспресс`.

## Frontend

Next.js App Router, React, TypeScript, Tailwind.

Основные маршруты:

- `frontend/app/page.tsx` -> `/`
- `frontend/app/sarma-express/page.tsx` -> `/sarma-express`
- `frontend/app/calculator/page.tsx` -> `/calculator`
- `frontend/app/pickup-points/page.tsx` -> `/pickup-points`
- `frontend/app/superbox/page.tsx` -> `/superbox`

Основные компоненты:

- `frontend/components/sarma-express-page.tsx`
- `frontend/components/sarma-express-header.tsx`
- `frontend/components/delivery-calculator-page.tsx`
- `frontend/components/pickup-points-page.tsx`
- `frontend/components/superbox-app.tsx`
- `frontend/app/globals.css`

## SUPERBOX flow

Поддерживаемые flow:

- `pickup_paid`
- `pickup_standard`
- `order_lookup`
- `home_delivery`
- `ship_russia`
- `cancel_order`
- `support`
- `tariffs`
- `business`

Открывать конкретный экран:

- `/superbox?flow=<flow_id>`

## Верхняя навигация

Файл: `frontend/components/sarma-express-header.tsx`.

Текущие пункты:

- `Калькулятор`
- `Отслеживание`
- `Бизнесу`
- `Тарифы`
- `Доставка из интернет-магазинов`
- `Отправления в РФ`
- `Пункты выдачи`

Важно: `Бизнесу` и `Тарифы` теперь разные пункты. `Бизнесу` ведет на заглушку, `Тарифы` - на таблицы тарифов.

## Главная страница

Файл: `frontend/components/sarma-express-page.tsx`.

Блок `Наши услуги` содержит 4 карточки:

- `ЭКСПРЕСС ДОСТАВКА`
- `LTL - СБОРНЫЕ ГРУЗЫ`
- `FTL - ПОЛНАЯ ЗАГРУЗКА`
- `ДОСТАВКА ИЗ ИНТЕРНЕТ-МАГАЗИНОВ`

Все 4 карточки сейчас являются ссылками на:

- `/superbox?flow=pickup_paid`

## Стиль Sarma

Основные признаки:

- общий `SarmaExpressHeader`;
- синий hero-фон с `frontend/public/brand/hero-background.png`;
- большие бело-голубые карточки;
- насыщенные синие CTA;
- темно-синий текст;
- мягкие тени и большие скругления.

Если пользователь просит "как на главной" или "под наш стиль", применять этот паттерн.

## Калькулятор

Файл: `frontend/components/delivery-calculator-page.tsx`.

Это пока UI без расчетной логики. Нельзя придумывать формулы самостоятельно.

## Пункты выдачи

Общие варианты ПВЗ:

- `shared/src/index.ts`

Страница карты:

- `frontend/components/pickup-points-page.tsx`

Текущий адрес Мариуполя:

- `Мариуполь, улица 60 лет СССР`

## Backend/shared

Backend:

- `backend/src/routes/orders.ts`
- `backend/src/services/order-service.ts`
- `backend/src/services/bitrix-service.ts`

Shared:

- `shared/src/index.ts`

Не трогать backend без явной необходимости. Для UI-задач обычно достаточно frontend и иногда `shared/src/index.ts`.

## Проверки

Для визуальных задач использовался Playwright через локальный `node` и скриншоты.

`npx eslint ...` из корня сейчас падает из-за отсутствия `eslint.config.js` для ESLint 9. Это не обязательно значит, что код сломан.
