"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  startTransition,
  useDeferredValue,
  useState,
  useTransition,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import {
  buildManualPreview,
  createHomeDeliveryOrderSchema,
  createPickupOrderSchema,
  createPickupStandardOrderSchema,
  humanizeMarketplace,
  marketplaceExampleUrls,
  numericIdSchema,
  pickupAddress,
  previewLinkSchema,
  supportTelegramUrl,
  type MarketplaceId,
  type OrderRecord,
  type ProductPreview,
} from "shared";

import { cancelOrder, createHomeDeliveryOrder, createPickupOrder, fetchOrder, previewLink } from "@/lib/api";

import { FlowShell } from "./flow-shell";
import { MarketplaceGrid } from "./marketplace-grid";
import { OrderSummaryCard } from "./order-summary-card";

type FlowId =
  | "overview"
  | "pickup_standard"
  | "order_lookup"
  | "pickup_paid"
  | "home_delivery"
  | "cancel_order"
  | "support"
  | "tariffs";

type SpecialPickupId = "courier" | "bulky";

type PickupState = {
  step: 1 | 2 | 3;
  marketplace: MarketplaceId | SpecialPickupId | "";
  firstName: string;
  lastName: string;
  phone: string;
  itemCount: string;
  totalAmount: string;
  sourceUrl: string;
  attachment: File | null;
  result: OrderRecord | null;
  errors: Record<string, string>;
};

type DeliveryState = {
  step: 1 | 2 | 3 | 4 | 5;
  marketplace: MarketplaceId | "";
  url: string;
  preview: ProductPreview | null;
  previewMode: "parsed" | "fallback" | null;
  parserMessage: string | null;
  firstName: string;
  phone: string;
  deliveryAddress: string;
  result: OrderRecord | null;
  errors: Record<string, string>;
};

function NoticeBox({ children, collapsible = false }: { children: ReactNode; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isCollapsed = collapsible && !expanded;
  return (
    <div>
      <div className={isCollapsed ? "relative max-h-[66px] overflow-hidden" : ""}>
        {children}
        {isCollapsed && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[rgba(245,158,11,0.18)] to-transparent" />
        )}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[10px] font-semibold text-amber-600 underline underline-offset-2 hover:text-amber-700"
        >
          {expanded ? "Свернуть ↑" : "Показать полностью ↓"}
        </button>
      )}
    </div>
  );
}


const actionCards: Array<{
  id: Exclude<FlowId, "overview">;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  featured?: boolean;
}> = [
  {
    id: "pickup_paid",
    eyebrow: "24 часа",
    title: "Оплаченный заказ",
    description: "Загрузите QR или штрих-код и проведите уже оплаченную покупку отдельно.",
    icon: "◎",
    featured: true,
  },
  {
    id: "order_lookup",
    eyebrow: "Track",
    title: "Найти заказ",
    description: "Проверьте статус по номеру заказа или телефону за пару секунд.",
    icon: "⌕",
  },
  {
    id: "pickup_standard",
    eyebrow: "Пункт выдачи",
    title: "Сделать заказ",
    description: "Оформите новую доставку со ссылкой на товар и прозрачной структурой для CRM.",
    icon: "+",
  },
  {
    id: "home_delivery",
    eyebrow: "300 ₽",
    title: "Доставка на дом",
    description: "Вставьте ссылку на товар, сохраните превью и отправьте курьером до двери.",
    icon: "⌂",
  },
  {
    id: "cancel_order",
    eyebrow: "Контроль",
    title: "Отменить",
    description: "Найдите заказ, проверьте статус и отмените без лишних переписок.",
    icon: "×",
  },
];

function createPickupState(): PickupState {
  return {
    step: 1,
    marketplace: "",
    firstName: "",
    lastName: "",
    phone: "",
    itemCount: "",
    totalAmount: "",
    sourceUrl: "",
    attachment: null,
    result: null,
    errors: {},
  };
}

function createDeliveryState(): DeliveryState {
  return {
    step: 1,
    marketplace: "",
    url: "",
    preview: null,
    previewMode: null,
    parserMessage: null,
    firstName: "",
    phone: "",
    deliveryAddress: "",
    result: null,
    errors: {},
  };
}

function BrandMark() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
      <Image
        src="/brand/superbox-logo.jpg"
        alt="SUPERBOX logo"
        width={40}
        height={40}
        className="h-10 w-10 object-cover"
        priority
      />
    </span>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="space-y-2">
      <span className="block text-sm font-semibold text-[color:var(--foreground)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-6 text-[color:var(--muted)]">{hint}</span> : null}
      {error ? <span className="block text-xs font-semibold text-[color:var(--danger)]">{error}</span> : null}
    </label>
  );
}

function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-full border border-[color:var(--line)] bg-white px-5 py-3.5 text-base text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(84,58,128,0.05)] placeholder:text-[color:rgba(44,47,48,0.28)] ${className ?? ""}`}
    />
  );
}

function InputWithSuffix({
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  suffix: string;
}) {
  const hasValue = props.value != null && String(props.value).trim().length > 0;

  return (
    <div className="relative">
      <Input {...props} className={`pr-16 ${className ?? ""}`} />
      {hasValue ? (
        <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-sm font-semibold text-[color:var(--muted)]">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function FileUploadCard({
  id,
  file,
  accept,
  onChange,
}: {
  id: string;
  file: File | null;
  accept?: string;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-subtle)] px-6 py-8 text-center"
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(196,46,160,0.14),rgba(124,51,255,0.16))] text-2xl text-[color:var(--accent-strong)]">
        ⬆
      </span>
      <span className="mt-5 text-lg font-semibold text-[color:var(--foreground)]">
        {file ? file.name : "Нажмите для загрузки"}
      </span>
      <span className="mt-2 text-sm text-[color:var(--muted)]">
        {file ? "Файл прикреплён. Можно продолжать." : "Поддерживаются изображения и PDF."}
      </span>
    </div>
  );
}

function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-32 w-full rounded-[28px] border border-[color:var(--line)] bg-white px-5 py-4 text-base text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(84,58,128,0.05)] placeholder:text-[color:rgba(44,47,48,0.28)] ${className ?? ""}`}
    />
  );
}

function PrimaryButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`primary-cta inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-7 py-3.5 text-sm font-semibold text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(84,58,128,0.04)] ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  centered = false,
  titleClassName,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  centered?: boolean;
  titleClassName?: string;
}) {
  const shouldRenderDescription = description && !description.startsWith("Откуда нужно забрать товар?");

  return (
    <div className={`${centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"} space-y-3`}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-strong)]">{eyebrow}</p> : null}
      <h1
        className={`font-[family-name:var(--font-display)] text-5xl leading-[0.95] text-[color:var(--foreground)] sm:text-6xl${
          titleClassName ? ` ${titleClassName}` : ""
        }`}
      >
        {title}
      </h1>
      {shouldRenderDescription ? <p className="text-base leading-8 text-[color:var(--muted)]">{description}</p> : null}
    </div>
  );
}

function ActionCard({
  title,
  eyebrow,
  description,
  icon,
  featured = false,
  active = false,
  className,
  onClick,
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  featured?: boolean;
  active?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[30px] text-left ${
        featured
          ? "min-h-[210px] bg-[linear-gradient(135deg,#b61f8f_0%,#9227dd_100%)] p-8 text-white shadow-[0_24px_54px_rgba(146,39,221,0.24)] lg:row-span-2"
          : active
            ? "soft-card border border-[color:var(--line-strong)] p-7 shadow-[0_18px_36px_rgba(157,76,255,0.14)]"
            : "soft-card p-7 hover:-translate-y-1"
      } ${className ?? ""}`}
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-semibold ${
          featured
            ? "bg-white/16 text-white"
            : active
              ? "bg-[linear-gradient(135deg,rgba(196,46,160,0.16),rgba(124,51,255,0.18))] text-[color:var(--accent-strong)]"
              : "bg-[color:var(--surface-soft)] text-[color:var(--accent)]"
        }`}
      >
        {icon}
      </div>
      <div className={`${featured ? "mt-16" : "mt-8"} space-y-2`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${featured ? "text-white/70" : "text-[color:var(--muted)]"}`}>{eyebrow}</p>
        <h2 className={`${featured ? "text-4xl" : "text-2xl"} font-[family-name:var(--font-display)] leading-none`}>{title}</h2>
        <p className={`${featured ? "text-white/78" : "text-[color:var(--muted)]"} text-sm leading-7`}>{description}</p>
      </div>
    </button>
  );
}

function SuccessState({
  order,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  order: OrderRecord;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <section className="mx-auto max-w-[820px] text-center">
      <div className="success-orb mx-auto text-3xl">✓</div>
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-5xl leading-none text-[color:var(--foreground)] sm:text-6xl">{title}</h1>
      <p className="mt-3 text-lg font-semibold text-[color:var(--muted)]">№ {order.orderNumber}</p>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[color:var(--muted)]">{description}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <div className="soft-card rounded-[30px] p-6 text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--accent-strong)]">
            {order.crmSyncState === "failed" ? "CRM временно недоступна" : "Ваш заказ в обработке"}
          </p>
          <p className="mt-3 text-base leading-8 text-[color:var(--muted)]">
            {order.crmSyncState === "failed"
              ? "Заказ сохранен локально, но сделка в Bitrix24 пока не создана. Повторите проверку статуса позже или свяжитесь с оператором, если CRM не восстановится."
              : "Мы уже готовим ваш заказ к следующему этапу. Статус можно проверять без Telegram, прямо в интерфейсе."}
          </p>
        </div>
        <div className="grid gap-4">
          <div className="soft-card rounded-[30px] p-6 text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Ожидаемое время</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-none text-[color:var(--accent-strong)]">15–25</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">минут до следующего статуса</p>
          </div>
          <div className="soft-card rounded-[30px] p-6 text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Маркетплейс</p>
            <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">{humanizeMarketplace(order.marketplace)}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <PrimaryButton onClick={onPrimary}>{primaryLabel}</PrimaryButton>
        {secondaryLabel && onSecondary ? <SecondaryButton onClick={onSecondary}>{secondaryLabel}</SecondaryButton> : null}
      </div>

      <div className="mt-8 text-left">
        <OrderSummaryCard order={order} />
      </div>
    </section>
  );
}

export function SuperboxApp() {
  const [activeFlow, setActiveFlow] = useState<FlowId>("overview");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [pickupStandard, setPickupStandard] = useState(createPickupState);
  const [pickupPaid, setPickupPaid] = useState(createPickupState);
  const [delivery, setDelivery] = useState(createDeliveryState);
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupOrder, setLookupOrder] = useState<OrderRecord | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cancelNumber, setCancelNumber] = useState("");
  const [cancelCandidate, setCancelCandidate] = useState<OrderRecord | null>(null);
  const [cancelResult, setCancelResult] = useState<OrderRecord | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [pending, startUiTransition] = useTransition();
  const lastScrollYRef = useRef(0);

  const deferredLookupNumber = useDeferredValue(lookupNumber);
  const deferredCancelNumber = useDeferredValue(cancelNumber);
  const activePickup = activeFlow === "pickup_paid" ? pickupPaid : pickupStandard;
  const setActivePickup = activeFlow === "pickup_paid" ? setPickupPaid : setPickupStandard;
  const activePickupSourceUrlPlaceholder =
    activePickup.marketplace && activePickup.marketplace in marketplaceExampleUrls
      ? marketplaceExampleUrls[activePickup.marketplace as MarketplaceId]
      : "https://example.com/product/...";
  const deliveryUrlPlaceholder = delivery.marketplace
    ? marketplaceExampleUrls[delivery.marketplace]
    : "https://example.com/product/...";

  const updatePickup = (patch: Partial<PickupState>) => setActivePickup((current) => ({ ...current, ...patch }));

  const openFlow = (flow: FlowId) => {
    setActiveFlow(flow);
  };

  const paidMarketplaceNotices: Partial<Record<string, ReactNode>> = {
    cdek: (
      <NoticeBox collapsible>
        <p>
          <strong>📍 Оформлять доставку СДЭК по адресу: ул. Вавилова, 69</strong>
        </p>
        <p>
          Получатель: <strong>Гринь Владимир Владиславович</strong>, 79900205973
        </p>
        <p className="mt-1">
          Если подключён <strong>СДЭК ID</strong>: укажите себя получателем, нам предоставьте только трек-номер и код выдачи.
        </p>
        <p className="mt-1">
          ✅ Подключение онлайн за 1 минуту: через Т-банк или онлайн-анкету СДЭК —{" "}
          <a href="https://www.cdek.ru/ru/cdek-id/#ways" target="_blank" rel="noreferrer" className="underline">
            cdek.ru/cdek-id
          </a>
        </p>
        <p className="mt-1">
          🔗 Приложение:{" "}
          <a href="https://clck.ru/3Phuv5" target="_blank" rel="noreferrer" className="underline">
            🔍 Google Play
          </a>
          {" · "}
          <a href="https://clck.ru/3Phuy4" target="_blank" rel="noreferrer" className="underline">
            🍏 App Store
          </a>
        </p>
      </NoticeBox>
    ),
    courier: (
      <NoticeBox collapsible>
        <p><strong>📦 Заказы курьером оформляйте на наш адрес в Ростове:</strong></p>
        <p className="mt-1">📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">🔲 Получатель: <strong>Игнатенко Глеб Игоревич</strong></p>
        <p>📞 Тел. <strong>+7 (989) 500-00-38</strong></p>
        <p className="mt-1">🗓 График: <strong>с 9:00 до 18:00, ЕЖЕДНЕВНО.</strong></p>
        <p className="mt-1 text-[10px] italic">Обязательно указывайте график работы для курьера в комментариях.</p>
      </NoticeBox>
    ),
    bulky: (
      <NoticeBox collapsible>
        <p><strong>📦 Заказы курьером оформляйте на наш адрес в Ростове:</strong></p>
        <p className="mt-1">📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">Получатель: <strong>Игнатенко Глеб Игоревич</strong></p>
        <p>📞 Тел. <strong>+7 (989) 500-00-38</strong></p>
        <p className="mt-1">🗓 График: <strong>с 9:00 до 18:00, ЕЖЕДНЕВНО.</strong></p>
        <p className="mt-1 text-[10px] italic">Обязательно указывайте график работы для курьера в комментариях.</p>
      </NoticeBox>
    ),
    "5post": (
      <NoticeBox collapsible>
        <p><strong>❗️ Оформление заказов 5POST</strong></p>
        <p className="mt-1">📍 Адрес доставки: г. Ростов-на-Дону, ул. Таганрогская, 118.</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
        <p className="mt-2 font-semibold">ℹ️ Подробная инструкция:</p>
        <p className="mt-1">1. Отправителю указать правильный адрес терминала: г. Ростов-на-Дону, ул. Таганрогская, 118.</p>
        <p className="mt-1">2. При отправлении указать свои данные как получателя груза. Пример: <em>Иванов Иван Иванович, тел: +79490000000</em></p>
        <p className="mt-1">3. При оформлении заказа вам поступит SMS с номером заказа и кодом получения.</p>
      </NoticeBox>
    ),
    dpd: (
      <NoticeBox collapsible>
        <p><strong>❗️ Оформление заказов DPD</strong></p>
        <p className="mt-1">📍 Адрес доставки: г. Ростов-на-Дону, ул. Таганрогская, 132/3.</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
        <p className="mt-2 font-semibold">ℹ️ Подробная инструкция:</p>
        <p className="mt-1">1. Отправителю указать правильный адрес терминала: г. Ростов-на-Дону, ул. Таганрогская, 132/3.</p>
        <p className="mt-1">2. При отправлении указать свои данные как получателя груза. Пример: <em>Иванов Иван Иванович, тел: +79490000000</em></p>
        <p className="mt-1">3. При оформлении заказа вам поступит SMS с номером заказа и кодом получения.</p>
      </NoticeBox>
    ),
    avito: (
      <NoticeBox collapsible>
        <p>📍 Адрес ПВЗ Avito: г. Ростов-на-Дону, ул. Вавилова, 68.</p>
        <p className="mt-1">Получатель: <strong>оформляйте на свои данные</strong>.</p>
        <p className="mt-1">Доставку оформляйте через <strong>«Avito доставку»</strong>: перейдите в раздел «Пункт выдачи», в фильтре выберите Avito, найдите адрес через поиск и выберите этот пункт.</p>
      </NoticeBox>
    ),
    wildberries: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Платона Кляты, 23.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">8%</span> от стоимости товаров
        </p>
      </NoticeBox>
    ),
    wildberries_premium: (
      <NoticeBox>
        <p>Доставка любого товара свыше 20 000 ₽ рассчитывается по физическому весу, а не по ценнику в корзине.</p>
        <p className="mt-1">
          <button
            type="button"
            onClick={() => openFlow("tariffs")}
            className="font-semibold underline underline-offset-2 hover:text-amber-700"
          >
            📋 Ссылка на тарифы →
          </button>
        </p>
        <p className="mt-1">📍 Адрес: г. Ростов-на-Дону, ул. Платона Кляты, 23.</p>
      </NoticeBox>
    ),
    detmir: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Таганрогская, 114И, ТЦ «Джанфида».</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
      </NoticeBox>
    ),
    letual: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    goldapple: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    lamoda: (
      <NoticeBox>
        <p>📍 Адрес ПВЗ: г. Ростов-на-Дону, ул. Таганрогская, 86.</p>
        <p className="mt-1">Получатель: <strong>ваши ФИО и номер телефона</strong>.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    yandex_market: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Таганрогская, 132/3.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    ozon: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Платона Кляты, 23.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          OZON — <span className="font-semibold text-green-700">бесплатно</span>
          {" · "}
          OZON Китай — <span className="font-semibold">8%</span>
        </p>
      </NoticeBox>
    ),
    wildberries_opt: (
      <NoticeBox>
        <p>Единый тариф на физический вес груза при заказе любых товаров общей стоимостью от 50 000 ₽.</p>
        <p className="mt-1">
          <button
            type="button"
            onClick={() => openFlow("tariffs")}
            className="font-semibold underline underline-offset-2 hover:text-amber-700"
          >
            📋 Ссылка на тарифы →
          </button>
        </p>
        <p className="mt-1">📍 Адрес: г. Ростов-на-Дону, ул. Платона Кляты, 23.</p>
      </NoticeBox>
    ),
  };

  const continuePickupSelection = () => {
    if (!activePickup.marketplace) {
      updatePickup({ errors: { marketplace: "Выберите маркетплейс" } });
      return;
    }
    startTransition(() => updatePickup({ step: 2, errors: {} }));
  };

  const continueDeliverySelection = () => {
    if (!delivery.marketplace) {
      setDelivery((current) => ({ ...current, errors: { marketplace: "Выберите маркетплейс" } }));
      return;
    }
    startTransition(() => setDelivery((current) => ({ ...current, step: 3, errors: {} })));
  };

  const submitPickup = async () => {
    const parsed =
      activeFlow === "pickup_standard"
        ? createPickupStandardOrderSchema.safeParse({
            orderType: activeFlow,
            marketplace: activePickup.marketplace,
            firstName: activePickup.firstName,
            lastName: activePickup.lastName,
            phone: activePickup.phone,
            itemCount: Number(activePickup.itemCount),
            totalAmount: Number(activePickup.totalAmount),
            sourceUrl: activePickup.sourceUrl,
          })
        : createPickupOrderSchema.safeParse({
            orderType: activeFlow,
            marketplace: activePickup.marketplace,
            firstName: activePickup.firstName,
            lastName: activePickup.lastName,
            phone: activePickup.phone,
            itemCount: Number(activePickup.itemCount),
            totalAmount: Number(activePickup.totalAmount),
          });

    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    if (activeFlow === "pickup_paid" && !activePickup.attachment) nextErrors.attachment = "Прикрепите QR или штрих-код.";
    if (Object.keys(nextErrors).length > 0) {
      updatePickup({ errors: nextErrors });
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await createPickupOrder({
          orderType: activeFlow as "pickup_standard" | "pickup_paid",
          marketplace: activePickup.marketplace,
          firstName: activePickup.firstName,
          lastName: activePickup.lastName,
          phone: activePickup.phone,
          itemCount: activePickup.itemCount,
          totalAmount: activePickup.totalAmount,
          sourceUrl: activeFlow === "pickup_standard" ? activePickup.sourceUrl : undefined,
          attachment: activeFlow === "pickup_paid" ? activePickup.attachment ?? undefined : undefined,
        });
        setActivePickup((current) => ({ ...current, step: 3, result: response.order, errors: {} }));
      } catch (error) {
        updatePickup({ errors: { form: error instanceof Error ? error.message : "Не удалось создать заказ" } });
      }
    });
  };

  const submitDeliveryPreview = async () => {
    const parsed = previewLinkSchema.safeParse({ marketplace: delivery.marketplace, url: delivery.url });
    const nextErrors: Record<string, string> = {};
    if (!delivery.marketplace) nextErrors.marketplace = "Выберите маркетплейс";
    if (!parsed.success) {
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    if (Object.keys(nextErrors).length > 0) {
      setDelivery((current) => ({ ...current, errors: nextErrors }));
      return;
    }
    const payload = parsed.data!;

    startUiTransition(async () => {
      try {
        const response = await previewLink(payload);
        setDelivery((current) => ({
          ...current,
          step: 4,
          preview: response.preview,
          previewMode: response.mode,
          parserMessage: response.message,
          errors: {},
        }));
      } catch (error) {
        const fallback = buildManualPreview(delivery.url, payload.marketplace);
        setDelivery((current) => ({
          ...current,
          step: 4,
          preview: fallback,
          previewMode: "fallback",
          parserMessage: error instanceof Error ? error.message : fallback.parserMessage,
          errors: {},
        }));
      }
    });
  };

  const submitDeliveryOrder = async () => {
    const parsed = createHomeDeliveryOrderSchema.safeParse({
      orderType: "home_delivery",
      marketplace: delivery.marketplace,
      firstName: delivery.firstName,
      phone: delivery.phone,
      deliveryAddress: delivery.deliveryAddress,
      sourceUrl: delivery.url,
      productPreview: delivery.preview,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? "form")] = issue.message;
      setDelivery((current) => ({ ...current, errors: nextErrors }));
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await createHomeDeliveryOrder({
          marketplace: delivery.marketplace,
          firstName: delivery.firstName,
          phone: delivery.phone,
          deliveryAddress: delivery.deliveryAddress,
          sourceUrl: delivery.url,
          productPreview: delivery.preview,
        });
        setDelivery((current) => ({ ...current, step: 5, result: response.order, errors: {} }));
      } catch (error) {
        setDelivery((current) => ({
          ...current,
          errors: { form: error instanceof Error ? error.message : "Не удалось создать доставку" },
        }));
      }
    });
  };

  const submitLookup = async () => {
    const parsed = numericIdSchema.safeParse(deferredLookupNumber);
    if (!parsed.success) {
      setLookupError(parsed.error.issues[0]?.message ?? "Введите корректный номер");
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetchOrder(parsed.data);
        setLookupOrder(response.order);
        setLookupError(null);
      } catch (error) {
        setLookupOrder(null);
        setLookupError(error instanceof Error ? error.message : "Заказ не найден");
      }
    });
  };

  const submitCancelLookup = async () => {
    const parsed = numericIdSchema.safeParse(deferredCancelNumber);
    if (!parsed.success) {
      setCancelError(parsed.error.issues[0]?.message ?? "Введите корректный номер");
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await fetchOrder(parsed.data);
        setCancelCandidate(response.order);
        setCancelResult(null);
        setCancelError(null);
      } catch (error) {
        setCancelCandidate(null);
        setCancelResult(null);
        setCancelError(error instanceof Error ? error.message : "Заказ не найден");
      }
    });
  };

  const submitCancel = async () => {
    if (!cancelCandidate) return;

    startUiTransition(async () => {
      try {
        const response = await cancelOrder(cancelCandidate.orderNumber);
        setCancelCandidate(null);
        setCancelResult(response.order);
        setCancelError(null);
      } catch (error) {
        setCancelError(error instanceof Error ? error.message : "Не удалось отменить заказ");
      }
    });
  };

  const pickupStepLabel = activePickup.step === 1 ? "Шаг 1 из 3" : activePickup.step === 2 ? "Шаг 2 из 3" : "Готово";
  const deliveryStepLabel =
    delivery.step === 1
      ? "Шаг 1 из 5"
      : delivery.step === 2
        ? "Шаг 2 из 5"
        : delivery.step === 3
          ? "Шаг 3 из 5"
          : delivery.step === 4
            ? "Шаг 4 из 5"
            : "Готово";

  const lookupChips = ["#SBX-2049-99", "+7 900 123 45 67", deferredLookupNumber ? `№ ${deferredLookupNumber}` : null].filter(Boolean);
  const cancelChips = ["Только активные заказы", deferredCancelNumber ? `Проверяем № ${deferredCancelNumber}` : null].filter(Boolean);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    let frame = 0;

    const syncHeaderVisibility = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;

      if (currentScrollY <= 24) {
        setIsHeaderHidden(false);
      } else if (delta > 10) {
        setIsHeaderHidden(true);
      } else if (delta < -10) {
        setIsHeaderHidden(false);
      }

      lastScrollYRef.current = currentScrollY;
      frame = 0;
    };

    const handleScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(syncHeaderVisibility);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const renderOverview = () => (
    <>
      <section className="soft-card relative overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(84,58,128,0.05)]">
              <span className="text-[color:var(--accent)]">•</span>
              {pickupAddress}
            </div>
            <div className="mt-8">
              <SectionIntro
                eyebrow=""
                titleClassName="hero-delivery-title"
                title={
                  <>
                    Оформление доставки в <span className="text-[color:var(--accent)] italic">пару кликов</span>
                  </>
                }
                description="Выберите действие и оформите заказ быстро и удобно. Мы собрали все сценарии в одном веб-интерфейсе: от поиска заказа до доставки по ссылке."
              />
            </div>
          </div>
          <div className="relative hidden justify-end lg:flex">
            <div className="package-visual" />
          </div>
        </div>
      </section>

      <section className="mt-8">
          <div className="grid gap-4 md:grid-cols-[1.02fr_1fr_1fr] md:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            {actionCards.map((card) => {
              const placementClass =
                card.featured
                  ? "md:row-span-2 md:min-h-[560px]"
                  : "md:min-h-[240px]";

            return (
              <ActionCard
                key={card.id}
                title={card.title}
                eyebrow={card.eyebrow}
                description={card.description}
                icon={card.icon}
                featured={card.featured}
                active={activeFlow === card.id}
                className={placementClass}
                onClick={() => openFlow(card.id)}
              />
            );
          })}
        </div>
      </section>
    </>
  );

  const specialPickupLabels: Record<SpecialPickupId, string> = {
    courier: "Отправлю курьера",
    bulky: "Крупногабарит",
  };

  const specialPickupOptions: Array<{ id: SpecialPickupId; icon: string; label: string; sub: string }> = [
    { id: "courier", icon: "🚚", label: "Отправлю курьера", sub: "другой заказ" },
    { id: "bulky", icon: "📦", label: "Крупногабарит", sub: "тяжёлые грузы" },
  ];

  const renderPickupFlow = () => {
    const paid = activeFlow === "pickup_paid";
    const isSpecial = paid && (activePickup.marketplace === "courier" || activePickup.marketplace === "bulky");
    const currentMarketplace = activePickup.marketplace
      ? (activePickup.marketplace in specialPickupLabels
          ? specialPickupLabels[activePickup.marketplace as SpecialPickupId]
          : humanizeMarketplace(activePickup.marketplace as MarketplaceId))
      : "Ничего не выбрано";

    if (activePickup.step === 1) {
      return (
        <section className="mx-auto max-w-[1140px]">
          <SectionIntro
            eyebrow=""
            title="Выберите маркетплейс"
            description={
              paid
                ? "Сначала выберите источник заказа, затем загрузите QR или штрих-код и завершите оформление в отдельном flow."
                : "Откуда нужно забрать товар? Сетка маркетплейсов приведена к единому виду и использует новый визуальный базис Stitch."
            }
            centered
          />
          {paid ? (
            <div className="mx-auto mt-8 max-w-3xl rounded-[28px] border border-[color:rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] p-5 text-center text-sm leading-7 text-[color:var(--foreground)]">
              QR и штрих-коды действуют ограниченное время. Не отправляйте их поздно вечером, чтобы менеджер успел принять заказ.
            </div>
          ) : null}
          <div className="mt-10">
            <MarketplaceGrid
              value={isSpecial ? "" : (activePickup.marketplace as MarketplaceId | "")}
              onSelect={(marketplace) => updatePickup({ marketplace, errors: {} })}
              filter={paid ? undefined : ["wildberries", "ozon"]}
            />
          </div>

          {paid && (
            <div className="mt-6">
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                Другие варианты
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {specialPickupOptions.map((opt) => {
                  const active = activePickup.marketplace === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePickup({ marketplace: opt.id, errors: {} })}
                      className={`group relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[28px] border px-5 py-5 text-center transition ${
                        active
                          ? "border-[color:rgba(196,46,160,0.32)] bg-white shadow-[0_20px_44px_rgba(123,77,255,0.18)]"
                          : "border-[rgba(123,77,255,0.2)] bg-[linear-gradient(135deg,rgba(123,77,255,0.05),rgba(196,46,160,0.04))] hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(59,26,110,0.08)]"
                      }`}
                    >
                      {active && (
                        <span className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c42ea0,#7c33ff)] text-xs font-bold text-white shadow-[0_10px_18px_rgba(123,77,255,0.22)]">
                          ✓
                        </span>
                      )}
                      <span className="text-3xl">{opt.icon}</span>
                      <span className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-semibold text-[color:var(--foreground)]">{opt.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">{opt.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {activePickup.errors.marketplace ? (
            <p className="mt-4 text-center text-sm font-semibold text-[color:var(--danger)]">{activePickup.errors.marketplace}</p>
          ) : null}
          <div className="sticky bottom-5 z-20 mx-auto mt-8 flex max-w-2xl items-center justify-between gap-4 rounded-[30px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_60px_rgba(84,58,128,0.14)] backdrop-blur">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">Выбрано</p>
              <p className="mt-1 text-base font-semibold text-[color:var(--foreground)]">{currentMarketplace}</p>
            </div>
            <PrimaryButton onClick={continuePickupSelection}>Продолжить</PrimaryButton>
          </div>
        </section>
      );
    }

    if (activePickup.step === 2) {
      return (
        <FlowShell
          eyebrow=""
          title={paid ? "Загрузите код и заполните детали" : "Детали заказа"}
          description={
            paid
              ? "Заполните данные клиента и загрузите QR или штрих-код. Мы сохраним заказ отдельным сценарием без смешивания со стандартной доставкой."
              : "Заполните форму ниже, чтобы мы могли обработать заказ с максимальной точностью"
          }
          stepLabel={pickupStepLabel}
          notice={paid && activePickup.marketplace ? paidMarketplaceNotices[activePickup.marketplace] : undefined}
          align="center"
          className="mx-auto max-w-[760px]"
        >
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPickup();
            }}
          >
            <div className="rounded-[24px] bg-[color:var(--surface-subtle)] px-5 py-4 text-sm leading-7 text-[color:var(--muted)]">
              Выбран маркетплейс: <span className="font-semibold text-[color:var(--foreground)]">{currentMarketplace}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Имя" htmlFor={`${activeFlow}-firstName`} error={activePickup.errors.firstName}>
                <Input id={`${activeFlow}-firstName`} autoFocus placeholder="Введите имя" value={activePickup.firstName} onChange={(event) => updatePickup({ firstName: event.target.value })} />
              </Field>
              <Field label="Фамилия" htmlFor={`${activeFlow}-lastName`} error={activePickup.errors.lastName}>
                <Input id={`${activeFlow}-lastName`} placeholder="Введите фамилию" value={activePickup.lastName} onChange={(event) => updatePickup({ lastName: event.target.value })} />
              </Field>
            </div>

            <Field label="Телефон" htmlFor={`${activeFlow}-phone`} hint="Формат +7XXXXXXXXXX" error={activePickup.errors.phone}>
              <Input id={`${activeFlow}-phone`} placeholder="+7 (___) ___-__-__" value={activePickup.phone} onChange={(event) => updatePickup({ phone: event.target.value })} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Количество" htmlFor={`${activeFlow}-count`} error={activePickup.errors.itemCount}>
                <InputWithSuffix id={`${activeFlow}-count`} type="number" min="1" suffix="шт." value={activePickup.itemCount} onChange={(event) => updatePickup({ itemCount: event.target.value })} />
              </Field>
              <Field label="Итоговая цена" htmlFor={`${activeFlow}-amount`} error={activePickup.errors.totalAmount}>
                <InputWithSuffix id={`${activeFlow}-amount`} type="number" min="1" suffix="₽" value={activePickup.totalAmount} onChange={(event) => updatePickup({ totalAmount: event.target.value })} />
              </Field>
            </div>

            {paid ? (
              <Field label="QR / штрих-код заказа" htmlFor={`${activeFlow}-attachment`} hint="PNG, JPG или PDF до 10 MB." error={activePickup.errors.attachment}>
                <FileUploadCard
                  id={`${activeFlow}-attachment`}
                  accept=".jpg,.jpeg,.png,.pdf"
                  file={activePickup.attachment}
                  onChange={(file) => updatePickup({ attachment: file })}
                />
                <div className="hidden">
                  <input
                    id={`${activeFlow}-attachment-hidden`}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="sr-only"
                    onChange={(event) => updatePickup({ attachment: event.target.files?.[0] ?? null })}
                  />
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(196,46,160,0.14),rgba(124,51,255,0.16))] text-2xl text-[color:var(--accent-strong)]">
                    ⌘
                  </span>
                  <span className="mt-5 text-lg font-semibold text-[color:var(--foreground)]">
                    {activePickup.attachment ? activePickup.attachment.name : "Нажмите для загрузки"}
                  </span>
                  <span className="mt-2 text-sm text-[color:var(--muted)]">
                    {activePickup.attachment ? "Файл прикреплён. Можно продолжать." : "Поддерживаются изображения и PDF."}
                  </span>
                </div>
              </Field>
            ) : (
              <Field label="Ссылка на товар" htmlFor={`${activeFlow}-sourceUrl`} hint="Ссылка должна соответствовать выбранному маркетплейсу." error={activePickup.errors.sourceUrl}>
                <Input
                  id={`${activeFlow}-sourceUrl`}
                  placeholder={activePickupSourceUrlPlaceholder}
                  value={activePickup.sourceUrl}
                  onChange={(event) => updatePickup({ sourceUrl: event.target.value })}
                />
              </Field>
            )}

            {activePickup.errors.form ? (
              <div className="rounded-[24px] border border-[color:rgba(220,38,38,0.16)] bg-[rgba(220,38,38,0.06)] px-5 py-4 text-sm font-semibold text-[color:var(--danger)]">
                {activePickup.errors.form}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <SecondaryButton type="button" onClick={() => updatePickup({ step: 1, errors: {} })}>
                Назад
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={pending}>
                {pending ? "Создаём..." : "Продолжить"}
              </PrimaryButton>
            </div>
          </form>
        </FlowShell>
      );
    }

    if (activePickup.result) {
      return (
        <SuccessState
          order={activePickup.result}
          title="Заказ успешно оформлен!"
          description="Мы уже приняли данные и сформировали заказ. Дальше можно создать новый заказ или сразу перейти к поиску статуса."
          primaryLabel="Создать ещё заказ"
          onPrimary={() => {
            setActivePickup(createPickupState());
          }}
          secondaryLabel="Проверить статус"
          onSecondary={() => openFlow("order_lookup")}
        />
      );
    }

    return null;
  };

  const renderDeliveryFlow = () => {
    if (delivery.step === 1) {
      return (
        <FlowShell
          eyebrow=""
          title="Доставка на дом"
          description="Фиксированная стоимость доставки по городу — 300 ₽. Далее выберите маркетплейс, вставьте ссылку и завершите оформление."
          stepLabel={deliveryStepLabel}
          align="center"
          className="mx-auto max-w-[820px]"
        >
          <div className="text-center">
            <div className="hidden rounded-[28px] border border-[color:rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] p-6 text-sm leading-8 text-[color:var(--foreground)]">
              Ссылка на товар либо распознается автоматически, либо уйдёт в ручной fallback без потери сценария.
            </div>
            <PrimaryButton onClick={() => setDelivery((current) => ({ ...current, step: 2 }))}>Продолжить</PrimaryButton>
          </div>
        </FlowShell>
      );
    }

    if (delivery.step === 2) {
      return (
        <section className="mx-auto max-w-[1140px]">
          <SectionIntro
            eyebrow="Marketplace"
            title="Выберите маркетплейс"
            description="Сначала фиксируем источник ссылки, чтобы парсер и fallback работали в правильном контексте."
            centered
          />
          <div className="mt-10">
            <MarketplaceGrid value={delivery.marketplace} onSelect={(marketplace) => setDelivery((current) => ({ ...current, marketplace, errors: {} }))} />
          </div>
          {delivery.errors.marketplace ? <p className="mt-4 text-center text-sm font-semibold text-[color:var(--danger)]">{delivery.errors.marketplace}</p> : null}
          <div className="mt-8 flex justify-center gap-3">
            <SecondaryButton onClick={() => setDelivery((current) => ({ ...current, step: 1 }))}>Назад</SecondaryButton>
            <PrimaryButton onClick={continueDeliverySelection}>Продолжить</PrimaryButton>
          </div>
        </section>
      );
    }

    if (delivery.step === 3) {
      return (
        <section className="mx-auto max-w-[920px]">
          <SectionIntro
            eyebrow=""
            title="Заказ по ссылке"
            description="Просто вставьте ссылку на товар и мы сделаем всё остальное. Выбранный маркетплейс уже сохранён."
            centered
          />
          <div className="mt-8 rounded-[34px] border border-white/70 bg-white/92 p-4 shadow-[0_24px_60px_rgba(84,58,128,0.1)]">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-[color:var(--surface-subtle)] px-5 py-3">
                <span className="text-[color:var(--accent-strong)]">⌁</span>
                <input
                  aria-label="Ссылка на товар"
                  className="min-w-0 flex-1 bg-transparent text-base text-[color:var(--foreground)] outline-none placeholder:text-[color:rgba(44,47,48,0.28)]"
                  placeholder={deliveryUrlPlaceholder}
                  value={delivery.url}
                  onChange={(event) => setDelivery((current) => ({ ...current, url: event.target.value }))}
                />
              </div>
              <PrimaryButton onClick={() => void submitDeliveryPreview()} disabled={pending} className="min-w-[164px]">
                {pending ? "Импорт..." : "Импорт"}
              </PrimaryButton>
            </div>
          </div>
          {delivery.errors.url ? <p className="mt-3 text-center text-sm font-semibold text-[color:var(--danger)]">{delivery.errors.url}</p> : null}
          <div className="hidden mx-auto mt-10 max-w-[760px] rounded-[34px] bg-white/92 p-6 shadow-[0_24px_60px_rgba(84,58,128,0.08)]">
            <div className="grid gap-5 md:grid-cols-[160px_1fr] md:items-center">
              <div className="h-40 rounded-[28px] bg-[linear-gradient(135deg,#6c7751,#a1b19a)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">{delivery.marketplace ? humanizeMarketplace(delivery.marketplace) : "Маркетплейс"}</p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Превью товара появится здесь</p>
                <p className="mt-3 text-base leading-8 text-[color:var(--muted)]">
                  После анализа покажем название, цену и данные для подтверждения заказа. Если парсер не справится, ссылку всё равно сохраним.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <SecondaryButton onClick={() => setDelivery((current) => ({ ...current, step: 2 }))}>Назад</SecondaryButton>
          </div>
        </section>
      );
    }

    if (delivery.step === 4) {
      return (
        <FlowShell
          eyebrow=""
          title="Подтвердите заказ"
          description="Проверьте распознанный товар и заполните данные получателя. Этот экран опирается на макет Stitch для доставки по ссылке."
          stepLabel={deliveryStepLabel}
          align="center"
          className="mx-auto max-w-[920px]"
        >
          <div className="space-y-6">
            <div className="rounded-[34px] bg-white p-6 shadow-[0_16px_34px_rgba(84,58,128,0.06)]">
              <div className="grid gap-5 md:grid-cols-[160px_1fr] md:items-center">
                <div className="h-40 rounded-[28px] bg-[linear-gradient(135deg,#6c7751,#a1b19a)]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--accent)]">
                    {delivery.marketplace ? humanizeMarketplace(delivery.marketplace) : "Маркетплейс"}
                  </p>
                  <p className="mt-3 text-4xl font-semibold leading-none text-[color:var(--foreground)]">
                    {delivery.preview?.title ?? "Товар будет обработан менеджером"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {delivery.preview?.price != null ? (
                      <span className="rounded-full bg-[linear-gradient(135deg,rgba(196,46,160,0.12),rgba(124,51,255,0.12))] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
                        {delivery.preview.price.toLocaleString("ru-RU")} ₽
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-base leading-8 text-[color:var(--muted)]">
                    {delivery.parserMessage ?? "Ссылка сохранена для ручной обработки менеджером."}
                  </p>
                </div>
              </div>
            </div>

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitDeliveryOrder();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Имя" htmlFor="delivery-firstName" error={delivery.errors.firstName}>
                  <Input id="delivery-firstName" autoFocus placeholder="Введите имя" value={delivery.firstName} onChange={(event) => setDelivery((current) => ({ ...current, firstName: event.target.value }))} />
                </Field>
                <Field label="Телефон" htmlFor="delivery-phone" error={delivery.errors.phone}>
                  <Input id="delivery-phone" placeholder="+7 (___) ___-__-__" value={delivery.phone} onChange={(event) => setDelivery((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
              </div>
              <Field label="Адрес доставки" htmlFor="delivery-address" error={delivery.errors.deliveryAddress}>
                <Textarea id="delivery-address" placeholder="Укажите полный адрес с подъездом и этажом" value={delivery.deliveryAddress} onChange={(event) => setDelivery((current) => ({ ...current, deliveryAddress: event.target.value }))} />
              </Field>
              {delivery.errors.form ? (
                <div className="rounded-[24px] border border-[color:rgba(220,38,38,0.16)] bg-[rgba(220,38,38,0.06)] px-5 py-4 text-sm font-semibold text-[color:var(--danger)]">
                  {delivery.errors.form}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <SecondaryButton type="button" onClick={() => setDelivery((current) => ({ ...current, step: 3 }))}>
                  Назад
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={pending}>
                  {pending ? "Создаём..." : "Добавить в заказ"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </FlowShell>
      );
    }

    if (delivery.result) {
      return (
        <SuccessState
          order={delivery.result}
          title="Заказ успешно оформлен!"
          description="Ссылка, адрес и контактные данные сохранены. Можно создать ещё одну доставку или вернуться на главный экран."
          primaryLabel="Создать ещё заказ"
          onPrimary={() => {
            setDelivery({ ...createDeliveryState(), step: 2 });
          }}
          secondaryLabel="На главную"
          onSecondary={() => openFlow("overview")}
        />
      );
    }

    return null;
  };

  const renderLookupFlow = () => (
    <section className="mx-auto max-w-[920px]">
      <SectionIntro
        eyebrow=""
        title="Найти заказ"
        description="Введите номер отслеживания или номер заказа, чтобы мгновенно узнать текущий статус доставки."
        centered
      />
      <div className="mt-8 rounded-[34px] border border-white/70 bg-white/92 p-4 shadow-[0_24px_60px_rgba(84,58,128,0.1)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="lookup-order"
            autoFocus
            inputMode="numeric"
            placeholder="ID заказа или +7 (___) ___-__-__"
            value={lookupNumber}
            onChange={(event) => setLookupNumber(event.target.value.replace(/[^\d]/g, ""))}
            className="flex-1 border-0 bg-[color:var(--surface-subtle)] shadow-none"
          />
          <PrimaryButton onClick={() => void submitLookup()} disabled={pending} className="min-w-[160px]">
            {pending ? "Ищем..." : "Поиск"}
          </PrimaryButton>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {lookupChips.map((chip) => (
          <span key={chip} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--muted)] shadow-[0_10px_24px_rgba(84,58,128,0.05)]">
            {chip}
          </span>
        ))}
      </div>
      {lookupError ? <p className="mt-4 text-center text-sm font-semibold text-[color:var(--danger)]">{lookupError}</p> : null}
      <div className="mt-10 rounded-[36px] border border-white/70 bg-white/78 p-6 shadow-[0_24px_60px_rgba(84,58,128,0.08)]">
        {lookupOrder ? (
          <OrderSummaryCard order={lookupOrder} />
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--surface-soft)] text-3xl text-[color:var(--muted)]">
              ⌕
            </div>
            <h2 className="mt-6 font-[family-name:var(--font-display)] text-4xl leading-none text-[color:var(--foreground)]">Введите данные для поиска</h2>
            <p className="mt-4 max-w-lg text-base leading-8 text-[color:var(--muted)]">
              Как только номер будет найден, покажем статус, логистику и основные данные заказа.
            </p>
          </div>
        )}
      </div>
    </section>
  );

  const renderCancelFlow = () => (
    <FlowShell
      eyebrow=""
      title="Отменить заказ"
      description="Сначала ищем заказ по номеру, затем показываем подтверждение. Завершенные и уже отменённые заказы не трогаем."
      align="center"
      className="mx-auto max-w-[860px]"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {cancelChips.map((chip) => (
            <span key={chip} className="rounded-full bg-[color:var(--surface-subtle)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)]">
              {chip}
            </span>
          ))}
        </div>
        <Field label="Номер заказа" htmlFor="cancel-order" error={cancelError ?? undefined}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="cancel-order"
              placeholder="669281"
              inputMode="numeric"
              value={cancelNumber}
              onChange={(event) => setCancelNumber(event.target.value.replace(/[^\d]/g, ""))}
              className="flex-1 bg-[color:var(--surface-subtle)] shadow-none"
            />
            <SecondaryButton onClick={() => void submitCancelLookup()} disabled={pending} className="sm:min-w-[180px]">
              {pending ? "Проверяем..." : "Найти заказ"}
            </SecondaryButton>
          </div>
        </Field>

        {cancelCandidate ? (
          <div className="space-y-4">
            <OrderSummaryCard order={cancelCandidate} compact />
            <PrimaryButton onClick={() => void submitCancel()} disabled={pending} className="w-full bg-[linear-gradient(135deg,#ff6b6b,#dc2626)] shadow-[0_18px_36px_rgba(220,38,38,0.22)]">
              {pending ? "Отменяем..." : "Подтвердить отмену"}
            </PrimaryButton>
          </div>
        ) : null}

        {cancelResult ? <OrderSummaryCard order={cancelResult} compact /> : null}
      </div>
    </FlowShell>
  );

  const renderSupportFlow = () => (
    <FlowShell
      eyebrow="Telegram support"
      title="Поддержка SUPERBOX"
      description="Если вопрос касается уже созданного заказа или нестандартной ситуации, откроем диалог с оператором без лишнего поиска контактов."
      align="center"
      className="mx-auto max-w-[760px]"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] bg-[color:var(--surface-subtle)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Перед переходом</p>
          <p className="mt-3 text-base leading-8 text-[color:var(--muted)]">Подготовьте номер заказа и короткое описание проблемы. Так ответ менеджера будет быстрее.</p>
        </div>
        <div className="rounded-[28px] bg-[color:var(--surface-subtle)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Канал связи</p>
          <p className="mt-3 text-base leading-8 text-[color:var(--muted)]">Поддержка работает в Telegram и подключается только в тех случаях, когда self-service уже недостаточно.</p>
        </div>
      </div>
      <div className="mt-6 text-center">
        <a
          href={supportTelegramUrl}
          target="_blank"
          rel="noreferrer"
          className="primary-cta inline-flex rounded-full px-7 py-3.5 text-sm font-semibold text-white"
        >
          Открыть Telegram
        </a>
      </div>
    </FlowShell>
  );

  const stdRates = [
    { w: "до 1 кг", p: "350 ₽" },
    { w: "1–1,9 кг", p: "450 ₽" },
    { w: "2–2,9 кг", p: "550 ₽" },
    { w: "3–4,9 кг", p: "650 ₽" },
    { w: "5–6,9 кг", p: "750 ₽" },
    { w: "7–7,9 кг", p: "850 ₽" },
    { w: "8–9,9 кг", p: "950 ₽" },
    { w: "10–11,9 кг", p: "1 150 ₽" },
    { w: "12–14,9 кг", p: "1 350 ₽" },
    { w: "15–15,9 кг", p: "1 450 ₽" },
    { w: "16–19,9 кг", p: "1 650 ₽" },
    { w: "20–24,9 кг", p: "1 750 ₽" },
    { w: "25–29,9 кг", p: "1 950 ₽" },
    { w: "30–39,9 кг", p: "2 150 ₽" },
    { w: "40–49,9 кг", p: "2 300 ₽" },
    { w: "50–59,9 кг", p: "2 500 ₽" },
    { w: "60–79,9 кг", p: "2 700 ₽" },
    { w: "80–99,9 кг", p: "3 000 ₽" },
  ];

  const bulkRates = [
    { w: "80–99,9 кг", wh: "3 000 ₽", door: "3 900 ₽" },
    { w: "100–149,9 кг", wh: "3 500 ₽", door: "4 500 ₽" },
    { w: "150–199,9 кг", wh: "4 200 ₽", door: "5 300 ₽" },
    { w: "200–299,9 кг", wh: "5 200 ₽", door: "6 400 ₽" },
    { w: "300–399,9 кг", wh: "6 500 ₽", door: "7 800 ₽" },
    { w: "400–499,9 кг", wh: "7 800 ₽", door: "9 300 ₽" },
  ];

  const renderTariffsView = () => (
    <section className="mx-auto w-full max-w-[1100px] space-y-6">
      {/* Header */}
      <div className="float-in text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--accent-strong)]">Цены · 2026</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none text-[color:var(--foreground)] sm:text-5xl">
          Тарифная сетка
        </h2>
        <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
          WB Дорогостой · WB ОПТ · СДЭК · Авито · DPD · БРОСТ
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Standard rates card */}
        <div className="flow-surface float-in rounded-[28px] p-6">
          <div className="mb-4 border-b border-[color:var(--line)] pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">Стандартная доставка</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">Склад → Склад</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                <th className="pb-2 text-left font-semibold">Вес посылки</th>
                <th className="pb-2 text-right font-semibold">Цена</th>
              </tr>
            </thead>
            <tbody>
              {stdRates.map((row, i) => (
                <tr
                  key={row.w}
                  className={`border-t border-[color:var(--line)] ${i % 2 === 0 ? "" : "bg-[color:var(--surface-soft)]"}`}
                >
                  <td className="py-2 text-[color:var(--muted)]">{row.w}</td>
                  <td className="py-2 text-right font-semibold text-[color:var(--foreground)]">{row.p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bulk + extras column */}
        <div className="flex flex-col gap-5">
          {/* Bulk rates card */}
          <div className="flow-surface float-in rounded-[28px] p-6" style={{ animationDelay: "60ms" }}>
            <div className="mb-4 border-b border-[color:var(--line)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">Крупногабаритные товары</p>
              <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">80 кг и выше</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <th className="pb-2 text-left font-semibold">Вес</th>
                  <th className="pb-2 text-right font-semibold">Склад → Склад</th>
                  <th className="pb-2 text-right font-semibold">До подъезда</th>
                </tr>
              </thead>
              <tbody>
                {bulkRates.map((row, i) => (
                  <tr
                    key={row.w}
                    className={`border-t border-[color:var(--line)] ${i % 2 === 0 ? "" : "bg-[color:var(--surface-soft)]"}`}
                  >
                    <td className="py-2 text-[color:var(--muted)]">{row.w}</td>
                    <td className="py-2 text-right font-semibold text-[color:var(--foreground)]">{row.wh}</td>
                    <td className="py-2 text-right font-semibold text-[color:var(--accent-strong)]">{row.door}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Additional services card */}
          <div className="flow-surface float-in rounded-[28px] p-6" style={{ animationDelay: "120ms" }}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">Дополнительные услуги</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[color:var(--muted)]">📦 Забор с адреса</span>
                <span className="text-sm font-bold text-[color:var(--foreground)]">1 500 ₽</span>
              </div>
              <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-3">
                <span className="text-sm text-[color:var(--muted)]">🏢 Подъём на этаж</span>
                <span className="text-sm font-bold text-[color:var(--foreground)]">700 ₽ / этаж</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important note */}
      <div
        className="float-in rounded-[20px] border border-[color:rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.07)] px-5 py-4"
        style={{ animationDelay: "180ms" }}
      >
        <p className="text-sm font-medium leading-6 text-[color:var(--foreground)]">
          ⚠️ <strong>Важно:</strong> Стоимость доставки рассчитывается по физическому или объёмному весу — применяется больший из двух показателей.
        </p>
      </div>

      {/* Back button */}
      <div className="flex justify-center pt-2">
        <SecondaryButton onClick={() => openFlow("overview")}>← Назад</SecondaryButton>
      </div>
    </section>
  );

  const renderMainContent = () => {
    if (activeFlow === "overview") return renderOverview();
    if (activeFlow === "pickup_standard" || activeFlow === "pickup_paid") return renderPickupFlow();
    if (activeFlow === "home_delivery") return renderDeliveryFlow();
    if (activeFlow === "order_lookup") return renderLookupFlow();
    if (activeFlow === "cancel_order") return renderCancelFlow();
    if (activeFlow === "tariffs") return renderTariffsView();
    return renderSupportFlow();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <header
        className={`soft-card sticky top-4 z-40 rounded-[28px] px-5 py-4 backdrop-blur transition-[transform,opacity,box-shadow] duration-300 ease-out ${
          isHeaderHidden ? "pointer-events-none opacity-0 shadow-none" : "opacity-100"
        }`}
        style={{ transform: isHeaderHidden ? "translateY(calc(-100% - 1rem)) scale(0.95)" : "translateY(0) scale(1)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => openFlow("overview")} className="flex items-center gap-3 rounded-full">
            <BrandMark />
            <Image
              src="/brand/superbox-wordmark.png"
              alt="Супер Бокс"
              width={1878}
              height={560}
              className="h-9 w-auto object-contain sm:h-11"
              priority
            />
            <span className="hidden">
              <span className="font-serif font-normal text-[#1a2e35]">Супер</span>
              <span className="font-serif font-normal text-[#c0176b]">Бокс</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openFlow("tariffs")}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(123,77,255,0.18)] bg-[color:var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5 hover:border-[rgba(123,77,255,0.3)] hover:shadow-[0_10px_24px_rgba(123,77,255,0.1)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sm shadow-[0_8px_18px_rgba(84,58,128,0.08)]">
                ₽
              </span>
              <span className="hidden sm:inline">Тарифы</span>
            </button>

            <a
              href={supportTelegramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(196,46,160,0.14)] bg-[linear-gradient(135deg,rgba(212,20,124,0.12),rgba(176,23,130,0.08))] px-4 py-2 text-sm font-semibold text-[color:var(--accent-strong)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(196,46,160,0.16)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-base shadow-[0_8px_18px_rgba(84,58,128,0.08)]">
                ↗
              </span>
              <span className="hidden sm:inline">Поддержка</span>
            </a>
          </div>
        </div>
      </header>

      <div className="mt-8 flex-1">{renderMainContent()}</div>

      <footer className="mt-16 flex flex-col gap-4 border-t border-white/60 py-8 text-sm text-[color:var(--muted)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-[color:#9aa8c2]">Супер Бокс</p>
          <p className="mt-1">© 2026 Супер Бокс.</p>
        </div>
      </footer>
    </main>
  );
}
