# AGENT.md

## Что это за проект

`sbpsite-main` - монорепозиторий с двумя связанными частями:

1. `Сарма Экспресс` - текущая публичная главная и маркетинговая оболочка.
2. `SUPERBOX` - прикладные сценарии заказов, выбора маркетплейсов, отслеживания, тарифов, отправлений и поддержки.

На текущем этапе пользователь хочет, чтобы ключевые `SUPERBOX flow` постепенно выглядели как новый стиль `Сарма Экспресс`: белая верхняя плашка, синий hero-фон с грузовиком, крупные светлые панели, синие CTA.

## Как работать

- Общаться с пользователем на русском.
- Работать точечно и быстро: проверить код, внести изменение, визуально проверить при необходимости.
- Для визуальных задач не делать широкий рефакторинг без явной просьбы.
- Не откатывать чужие изменения и не удалять пользовательские ассеты без запроса.

## Главные маршруты

Публичные страницы:

- `/` - главная `Сарма Экспресс`
- `/sarma-express` - та же главная
- `/calculator` - калькулятор
- `/pickup-points` - пункты выдачи

`SUPERBOX`:

- `/superbox`
- `/superbox?flow=pickup_paid` - выбор маркетплейсов и оформление оплаченных заказов
- `/superbox?flow=pickup_standard` - заказ по ссылке
- `/superbox?flow=order_lookup` - отслеживание
- `/superbox?flow=ship_russia` - отправления в РФ
- `/superbox?flow=tariffs` - тарифы
- `/superbox?flow=business` - заглушка `скоро добавим)`

## Актуальная верхняя навигация

Файл: `frontend/components/sarma-express-header.tsx`

- `Калькулятор` -> `/calculator`
- `Отслеживание` -> `/superbox?flow=order_lookup`
- `Бизнесу` -> `/superbox?flow=business`
- `Тарифы` -> `/superbox?flow=tariffs`
- `Доставка из интернет-магазинов` -> `/superbox?flow=pickup_paid`
- `Отправления в РФ` -> `/superbox?flow=ship_russia`
- `Пункты выдачи` -> `/pickup-points`

## Важные файлы

Читать в начале нового диалога:

1. `AGENT.md`
2. `CURRENT_STATUS.md`
3. `PROJECT_CONTEXT.md`
4. `HANDOFF.md`

Ключевые компоненты:

- `frontend/components/sarma-express-header.tsx`
- `frontend/components/sarma-express-page.tsx`
- `frontend/components/delivery-calculator-page.tsx`
- `frontend/components/pickup-points-page.tsx`
- `frontend/components/superbox-app.tsx`
- `frontend/app/globals.css`
- `shared/src/index.ts`

Backend трогать только если задача явно про заказы/Bitrix:

- `backend/src/routes/orders.ts`
- `backend/src/services/order-service.ts`
- `backend/src/services/bitrix-service.ts`

## Текущее состояние UI

- Главная `Сарма Экспресс` стоит на `/`.
- Все 4 карточки блока `Наши услуги` на главной ведут на `/superbox?flow=pickup_paid`.
- Калькулятор визуальный, без настоящих формул расчета.
- У калькулятора кастомные современные dropdown, контрастные поля и плоский ввод без внутренней квадратной рамки.
- Страница отслеживания `order_lookup` стилизована под Sarma, кнопка поиска синяя.
- Страница тарифов вынесена в отдельный пункт `Тарифы`.
- Страница `Бизнесу` теперь отдельный `flow=business` с заглушкой `скоро добавим)`.
- `pickup_paid` и `pickup_standard` открываются сразу в нужный `flow`, без мигания старого overview.
- Первый шаг выбора маркетплейсов и второй шаг анкеты в `pickup_paid` / `pickup_standard` переведены в Sarma-стиль.
- `ship_russia` тоже стилизован под Sarma.

## Пункты выдачи

Источник общих пунктов: `shared/src/index.ts`.

Текущая правка адреса:

- `Мариуполь, улица 60 лет СССР` без `дом 8`.

Страница карты: `frontend/components/pickup-points-page.tsx`.

Яндекс Карты используют `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` из `frontend/.env.local`. Локально карта может показывать предупреждение `Invalid API key`; при проблемах сначала проверять ключ и ограничения доменов.

## Практические правила

- Если задача про верхнее меню - начинать с `sarma-express-header.tsx`.
- Если задача про конкретный сценарий Superbox - смотреть `superbox-app.tsx` и существующий `flow`.
- Если задача про адреса ПВЗ - синхронизировать `shared/src/index.ts` и при необходимости `pickup-points-page.tsx`.
- Если пользователь просит "как на главной" - использовать общий `SarmaExpressHeader` и синий фон `brand/hero-background.png`.
