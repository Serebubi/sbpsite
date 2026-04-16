"use client";

import Image from "next/image";
import {
  Fragment,
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
  bulkyAttachmentLimit,
  createHomeDeliveryOrderSchema,
  homeDeliveryTimeSlotValues,
  createPaidPickupOrderSchema,
  createPickupStandardOrderSchema,
  humanizeMarketplace,
  marketplaceExampleUrls,
  numericIdSchema,
  pickupAddress,
  supportTelegramUrl,
  type HomeDeliveryTimeSlot,
  type MarketplaceId,
  type OrderRecord,
} from "shared";

import { cancelOrder, createHomeDeliveryOrder, createPickupOrder, fetchOrder, lookupOrder as lookupTrackedOrder } from "@/lib/api";

import { FlowShell } from "./flow-shell";
import { MarketplaceGrid } from "./marketplace-grid";
import { OrderSummaryCard } from "./order-summary-card";

type FlowId =
  | "overview"
  | "pickup_standard"
  | "order_lookup"
  | "pickup_paid"
  | "home_delivery"
  | "ship_russia"
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
  size: string;
  itemCount: string;
  totalAmount: string;
  trackingNumber: string;
  shipmentNumber: string;
  senderName: string;
  pickupCode: string;
  sourceUrl: string;
  attachment: File | null;
  bulkyAttachments: File[];
  productAttachment: File | null;
  result: OrderRecord | null;
  errors: Record<string, string>;
};

type DeliveryState = {
  step: 1 | 2;
  orderNumbers: string[];
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTimeSlot: HomeDeliveryTimeSlot | "";
  result: OrderRecord | null;
  errors: Record<string, string>;
};

type PaidFieldCopy = {
  itemCountLabel: string;
  totalAmountLabel: string;
  attachmentLabel: string;
  attachmentHint: string;
  attachmentRequiredError: string;
};

const defaultPaidFieldCopy: PaidFieldCopy = {
  itemCountLabel: "Количество товаров",
  totalAmountLabel: "Итоговая цена всех товаров",
  attachmentLabel: "QR / штрих-код заказа",
  attachmentHint: "PNG, JPG или PDF до 10 MB.",
  attachmentRequiredError: "Прикрепите QR или штрих-код.",
};

const paidFieldCopyByMarketplace: Partial<Record<MarketplaceId | SpecialPickupId, PaidFieldCopy>> = {
  cdek: {
    itemCountLabel: "Введите общее количество товаров для получения:",
    totalAmountLabel: "Укажите, пожалуйста, общую сумму всех товаров в заказе:",
    attachmentLabel: "Штрих-код или QR код для получения (Сделайте скриншот и приложите его)",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "Приложите штрих-код или QR код для получения.",
  },
  "5post": {
    itemCountLabel: "Укажите трек-номер",
    totalAmountLabel: "Код получения",
    attachmentLabel: "Скриншот отправления (можно пропустить)",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "",
  },
  dpd: {
    itemCountLabel: "Укажите трек-номер",
    totalAmountLabel: "Код получения",
    attachmentLabel: "Скриншот отправления (можно пропустить)",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "",
  },
  avito: {
    itemCountLabel: "Укажите трек-номер",
    totalAmountLabel: "Код получения",
    attachmentLabel: "Скриншот отправления (можно пропустить)",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "",
  },
  goldapple: {
    itemCountLabel: "Количество товаров",
    totalAmountLabel: "Итоговая цена всех товаров",
    attachmentLabel: "Скриншот заказа",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "Прикрепите скриншот заказа.",
  },
  letual: {
    itemCountLabel: "Количество товаров",
    totalAmountLabel: "Итоговая цена всех товаров",
    attachmentLabel: "Скриншот заказа",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "Прикрепите скриншот заказа.",
  },
  detmir: {
    itemCountLabel: "Количество товаров",
    totalAmountLabel: "Итоговая цена всех товаров",
    attachmentLabel: "Скриншот заказа",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "Прикрепите скриншот заказа.",
  },
  courier: {
    itemCountLabel: "Количество товаров",
    totalAmountLabel: "Итоговая цена всех товаров",
    attachmentLabel: "QR / штрих-код заказа / скриншот товара или груза",
    attachmentHint: "PNG, JPG или PDF до 10 MB.",
    attachmentRequiredError: "Прикрепите QR, штрих-код или скриншот товара.",
  },
  bulky: {
    itemCountLabel: "Количество товаров",
    totalAmountLabel: "Итоговая цена всех товаров",
    attachmentLabel: "QR / штрих-код заказа / скриншот товара или груза",
    attachmentHint: "PNG, JPG или PDF до 10 MB. До 10 файлов.",
    attachmentRequiredError: "Прикрепите QR, штрих-код или скриншот товара.",
  },
};

function getPaidFieldCopy(marketplace: PickupState["marketplace"]) {
  if (!marketplace) {
    return defaultPaidFieldCopy;
  }

  return paidFieldCopyByMarketplace[marketplace as MarketplaceId | SpecialPickupId] ?? defaultPaidFieldCopy;
}

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
  accent?: "soft";
}> = [
  {
    id: "pickup_paid",
    eyebrow: "24 часа",
    title: "Самостоятельный заказ",
    description: "Загрузите QR или штрих-код и проведите уже оплаченную покупку отдельно.",
    icon: "◎",
    featured: true,
  },
  {
    id: "pickup_standard",
    eyebrow: "Пункт выдачи",
    title: "Сделать заказ по ссылке",
    description: "Оформите новую доставку со ссылкой на товар и прозрачной структурой для CRM.",
    icon: "+",
    accent: "soft",
  },
  {
    id: "order_lookup",
    eyebrow: "Track",
    title: "Отследить посылку",
    description: "Проверьте статус по номеру заказа или телефону за пару секунд.",
    icon: "⌕",
  },
  {
    id: "home_delivery",
    eyebrow: "300 ₽",
    title: "Доставка на дом",
    description: "Оформите доставку уже созданных заказов на домашний адрес.",
    icon: "⌂",
  },
  {
    id: "cancel_order",
    eyebrow: "Контроль",
    title: "Отменить заказ",
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
    size: "",
    itemCount: "",
    totalAmount: "",
    trackingNumber: "",
    shipmentNumber: "",
    senderName: "",
    pickupCode: "",
    sourceUrl: "",
    attachment: null,
    bulkyAttachments: [],
    productAttachment: null,
    result: null,
    errors: {},
  };
}

function createDeliveryState(): DeliveryState {
  return {
    step: 1,
    orderNumbers: [""],
    deliveryAddress: "",
    deliveryDate: "",
    deliveryTimeSlot: "",
    result: null,
    errors: {},
  };
}

function normalizeOrderNumbersInput(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
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
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-[color:var(--foreground)]">
        {label}
      </label>
      {children}
      {hint ? <span className="block text-xs leading-6 text-[color:var(--muted)]">{hint}</span> : null}
      {error ? <span className="block text-xs font-semibold text-[color:var(--danger)]">{error}</span> : null}
    </div>
  );
}

const fieldStateLabelClass = "whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]";

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
      onClick={(event) => {
        if (event.target === inputRef.current) {
          return;
        }

        event.preventDefault();
        openFilePicker();
      }}
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
        onClick={(event) => event.stopPropagation()}
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

function HeroDeliveryVisual() {
  return (
    <div aria-hidden="true" className="relative w-[min(44rem,44vw)] max-w-full pr-2">
      <Image
        src="/hero-home-replacement.png"
        alt=""
        width={1536}
        height={1024}
        sizes="(min-width: 1280px) 42vw, (min-width: 1024px) 38vw, 0px"
        className="h-auto w-full object-contain [filter:drop-shadow(0_28px_44px_rgba(181,151,232,0.24))]"
        priority
      />
    </div>
  );
}

function MultiFileUploadCard({
  id,
  files,
  accept,
  maxFiles,
  onChange,
}: {
  id: string;
  files: File[];
  accept?: string;
  maxFiles: number;
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(maxFiles - files.length, 0);
  const summary =
    files.length === 0
      ? "Поддерживаются изображения и PDF."
      : remaining > 0
        ? `Загружено ${files.length} из ${maxFiles}. Можно добавить ещё ${remaining}.`
        : `Загружено ${files.length} из ${maxFiles}. Лимит достигнут.`;
  const previewNames =
    files.length > 0
      ? files
          .slice(0, 3)
          .map((file) => file.name)
          .join(", ")
      : null;

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target === inputRef.current) {
          return;
        }

        event.preventDefault();
        openFilePicker();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      className="relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[color:var(--line)] bg-[color:var(--surface-subtle)] px-6 py-8 text-center"
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          onChange(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <span className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--accent-strong)] shadow-[0_10px_24px_rgba(84,58,128,0.08)]">
        {files.length}/{maxFiles}
      </span>
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(196,46,160,0.14),rgba(124,51,255,0.16))] text-2xl text-[color:var(--accent-strong)]">
        ↑
      </span>
      <span className="mt-5 text-lg font-semibold text-[color:var(--foreground)]">
        {files.length > 0 ? `Загружено ${files.length} файлов` : "Нажмите для загрузки"}
      </span>
      <span className="mt-2 text-sm text-[color:var(--muted)]">{summary}</span>
      {previewNames ? (
        <span className="mt-3 max-w-full truncate text-xs text-[color:var(--muted)]">
          {previewNames}
          {files.length > 3 ? ` и ещё ${files.length - 3}` : ""}
        </span>
      ) : null}
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
  accent,
  active = false,
  className,
  onClick,
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  featured?: boolean;
  accent?: "soft";
  active?: boolean;
  className?: string;
  onClick: () => void;
}) {
  const softAccent = accent === "soft";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[30px] text-left ${
        featured
          ? "min-h-[210px] bg-[linear-gradient(135deg,#b61f8f_0%,#9227dd_100%)] p-8 text-white shadow-[0_24px_54px_rgba(146,39,221,0.24)] hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(146,39,221,0.28)] lg:row-span-2"
          : active
            ? softAccent
              ? "border border-[rgba(109,40,217,0.26)] bg-[linear-gradient(135deg,#8b4fd0_0%,#6d28d9_100%)] p-7 text-white shadow-[0_22px_42px_rgba(109,40,217,0.22)]"
              : "soft-card border border-[color:var(--line-strong)] p-7 shadow-[0_18px_36px_rgba(157,76,255,0.14)]"
            : softAccent
              ? "border border-[rgba(109,40,217,0.2)] bg-[linear-gradient(135deg,#9b5de5_0%,#7c3aed_100%)] p-7 text-white shadow-[0_18px_38px_rgba(109,40,217,0.16)] hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(109,40,217,0.2)]"
              : "soft-card p-7 hover:-translate-y-1"
      } ${className ?? ""}`}
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-semibold ${
          featured
            ? "bg-white/16 text-white"
            : active
              ? softAccent
                ? "bg-white/18 text-white"
                : "bg-[linear-gradient(135deg,rgba(196,46,160,0.16),rgba(124,51,255,0.18))] text-[color:var(--accent-strong)]"
              : softAccent
                ? "bg-white/16 text-white"
                : "bg-[color:var(--surface-soft)] text-[color:var(--accent)]"
        }`}
      >
        {icon}
      </div>
      <div className={`${featured ? "mt-16" : "mt-8"} space-y-2`}>
        <h2 className={`${featured ? "text-4xl" : "text-2xl"} font-[family-name:var(--font-display)] leading-none`}>{title}</h2>
        <p className={`${featured ? "text-white/78" : softAccent ? "text-white/82" : "text-[color:var(--muted)]"} text-sm leading-7`}>{description}</p>
      </div>
    </button>
  );
}

function ShipRussiaVisualPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative h-full min-h-[230px] overflow-hidden rounded-[30px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(246,241,255,0.92))] p-5 shadow-[0_18px_40px_rgba(84,58,128,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,46,160,0.1),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(124,51,255,0.12),transparent_42%)]" />
      <div className="relative flex h-full flex-col justify-between rounded-[24px] border border-dashed border-[rgba(123,77,255,0.24)] bg-white/72 p-6 backdrop-blur-sm">
        <span className="inline-flex w-fit rounded-full bg-[rgba(196,46,160,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
          Заглушка
        </span>
        <div>
          <p className="text-2xl font-[family-name:var(--font-display)] leading-none text-[color:var(--foreground)]">{title}</p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-[color:var(--muted)]">{description}</p>
        </div>
      </div>
    </div>
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

      <div className="mt-8 grid items-start gap-4 md:grid-cols-[1.15fr_0.85fr]">
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
        <div className="soft-card rounded-[30px] p-6 text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Маркетплейс</p>
          <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">{humanizeMarketplace(order.marketplace)}</p>
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

function isPhoneLookupQuery(query: string) {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  return /^[+\d\s()-]+$/.test(trimmed) && (digits.length === 10 || digits.length === 11);
}

export function SuperboxApp() {
  const [activeFlow, setActiveFlow] = useState<FlowId>("overview");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [pickupStandard, setPickupStandard] = useState(createPickupState);
  const [pickupPaid, setPickupPaid] = useState(createPickupState);
  const [delivery, setDelivery] = useState(createDeliveryState);
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupOrders, setLookupOrders] = useState<OrderRecord[]>([]);
  const [lookupHideSensitiveDetails, setLookupHideSensitiveDetails] = useState(false);
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

  const updatePickup = (patch: Partial<PickupState>) => setActivePickup((current) => ({ ...current, ...patch }));
  const setBulkyAttachments = (selectedFiles: File[]) =>
    setActivePickup((current) => {
      const combined = [...current.bulkyAttachments];

      for (const file of selectedFiles) {
        const duplicate = combined.some(
          (existing) =>
            existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified,
        );
        if (!duplicate) {
          combined.push(file);
        }
      }

      const nextFiles = combined.slice(0, bulkyAttachmentLimit);
      const nextErrors = { ...current.errors };
      if (combined.length > bulkyAttachmentLimit) {
        nextErrors.attachment = `Можно загрузить не более ${bulkyAttachmentLimit} файлов.`;
      } else {
        delete nextErrors.attachment;
      }

      return {
        ...current,
        attachment: nextFiles[0] ?? null,
        bulkyAttachments: nextFiles,
        errors: nextErrors,
      };
    });
  const removeBulkyAttachment = (index: number) =>
    setActivePickup((current) => {
      const nextFiles = current.bulkyAttachments.filter((_, fileIndex) => fileIndex !== index);
      const nextErrors = { ...current.errors };
      delete nextErrors.attachment;

      return {
        ...current,
        attachment: nextFiles[0] ?? null,
        bulkyAttachments: nextFiles,
        errors: nextErrors,
      };
    });

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
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
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
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
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
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
      </NoticeBox>
    ),
    letual: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    goldapple: (
      <NoticeBox>
        <p>📍 Адрес: г. Ростов-на-Дону, ул. Арсенальная 1 Вавилова (71Ж/2).</p>
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
        <p className="mt-1">
          <span className="font-semibold">Стоимость доставки:</span>{" "}
          <span className="font-semibold">10%</span> от стоимости заказа
        </p>
      </NoticeBox>
    ),
    lamoda: (
      <NoticeBox>
        <p>📍 Адрес ПВЗ: г. Ростов-на-Дону, ул. Таганрогская, 86.</p>
        <p className="mt-1">Получатель: <strong>ваши имя, фамилия и номер телефона</strong>.</p>
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
        <p className="mt-1">Если хотите отказаться от товаров, напишите в &quot;Прием заказов&quot;, пришлите скриншоты товаров, от которых отказ и номер заказа.</p>
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

  const submitPickup = async () => {
    const paidFieldCopy = getPaidFieldCopy(activePickup.marketplace);
    const isCdekPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "cdek";
    const isDetmirPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "detmir";
    const isGoldapplePaid = activeFlow === "pickup_paid" && activePickup.marketplace === "goldapple";
    const isLetualPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "letual";
    const isWildberriesPremiumPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "wildberries_premium";
    const isCourierPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "courier";
    const isBulkyPaid = activeFlow === "pickup_paid" && activePickup.marketplace === "bulky";
    const isTrackingCodePaid =
      activeFlow === "pickup_paid" &&
      (activePickup.marketplace === "5post" || activePickup.marketplace === "dpd" || activePickup.marketplace === "avito");
    const usesTrackingPickupFields = isCdekPaid || isTrackingCodePaid;
    const parsed =
      activeFlow === "pickup_standard"
        ? createPickupStandardOrderSchema.safeParse({
            orderType: activeFlow,
            marketplace: activePickup.marketplace,
            firstName: activePickup.firstName,
            lastName: activePickup.lastName,
            phone: activePickup.phone,
            size: activePickup.size.trim() || undefined,
            sourceUrl: activePickup.sourceUrl,
          })
        : createPaidPickupOrderSchema.safeParse({
            orderType: activeFlow,
            marketplace: activePickup.marketplace,
            firstName: activePickup.firstName,
            lastName: activePickup.lastName,
            phone: activePickup.phone,
            itemCount: usesTrackingPickupFields || isWildberriesPremiumPaid || isBulkyPaid ? undefined : Number(activePickup.itemCount),
            totalAmount: usesTrackingPickupFields || isBulkyPaid ? undefined : Number(activePickup.totalAmount),
            trackingNumber: usesTrackingPickupFields || isDetmirPaid || isGoldapplePaid || isLetualPaid || isCourierPaid || isBulkyPaid ? activePickup.trackingNumber : undefined,
            shipmentNumber: isCdekPaid ? activePickup.shipmentNumber : undefined,
            senderName: isCourierPaid || isBulkyPaid ? activePickup.senderName : undefined,
            pickupCode: usesTrackingPickupFields || isDetmirPaid || isCourierPaid || isBulkyPaid ? activePickup.pickupCode : undefined,
          });

    const nextErrors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    if (isBulkyPaid && activePickup.bulkyAttachments.length === 0) nextErrors.attachment = paidFieldCopy.attachmentRequiredError;
    if (activeFlow === "pickup_paid" && !usesTrackingPickupFields && !isBulkyPaid && !activePickup.attachment) nextErrors.attachment = paidFieldCopy.attachmentRequiredError;
    if (isWildberriesPremiumPaid && !activePickup.productAttachment) nextErrors.productAttachment = "Прикрепите скриншот товара.";
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
          size: activeFlow === "pickup_standard" ? activePickup.size.trim() || undefined : undefined,
          itemCount:
            activeFlow === "pickup_paid" && !usesTrackingPickupFields && !isWildberriesPremiumPaid && !isBulkyPaid
              ? activePickup.itemCount
              : undefined,
          totalAmount:
            activeFlow === "pickup_paid" && !usesTrackingPickupFields && !isBulkyPaid
              ? activePickup.totalAmount
              : undefined,
          trackingNumber: usesTrackingPickupFields || isDetmirPaid || isGoldapplePaid || isLetualPaid || isCourierPaid || isBulkyPaid ? activePickup.trackingNumber : undefined,
          shipmentNumber: isCdekPaid ? activePickup.shipmentNumber : undefined,
          senderName: isCourierPaid || isBulkyPaid ? activePickup.senderName : undefined,
          pickupCode: usesTrackingPickupFields || isDetmirPaid || isCourierPaid || isBulkyPaid ? activePickup.pickupCode : undefined,
          sourceUrl: activeFlow === "pickup_standard" ? activePickup.sourceUrl : undefined,
          attachment: activeFlow === "pickup_paid" && !isBulkyPaid ? activePickup.attachment ?? undefined : undefined,
          bulkyAttachments: activeFlow === "pickup_paid" && isBulkyPaid ? activePickup.bulkyAttachments : undefined,
          productAttachment: activeFlow === "pickup_paid" && isWildberriesPremiumPaid ? activePickup.productAttachment ?? undefined : undefined,
        });
        setActivePickup((current) => ({ ...current, step: 3, result: response.order, errors: {} }));
      } catch (error) {
        updatePickup({ errors: { form: error instanceof Error ? error.message : "Не удалось создать заказ" } });
      }
    });
  };

  const submitDeliveryOrder = async () => {
    const orderNumbers = normalizeOrderNumbersInput(delivery.orderNumbers);
    const parsed = createHomeDeliveryOrderSchema.safeParse({
      orderType: "home_delivery",
      orderNumbers,
      deliveryAddress: delivery.deliveryAddress,
      deliveryDate: delivery.deliveryDate,
      deliveryTimeSlot: delivery.deliveryTimeSlot,
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
          orderNumbers,
          deliveryAddress: delivery.deliveryAddress,
          deliveryDate: delivery.deliveryDate,
          deliveryTimeSlot: delivery.deliveryTimeSlot as HomeDeliveryTimeSlot,
        });
        setDelivery((current) => ({ ...current, step: 2, result: response.order, errors: {} }));
      } catch (error) {
        setDelivery((current) => ({
          ...current,
          errors: { form: error instanceof Error ? error.message : "Не удалось создать доставку" },
        }));
      }
    });
  };

  const submitLookupLegacy = async () => {
    const query = deferredLookupNumber.trim();
    const parsed = {
      success: query.length > 0,
      error: { issues: [{ message: "Введите номер заказа, трек-номер или телефон." }] },
      data: query,
    };
    if (!parsed.success) {
      setLookupError(parsed.error.issues[0]?.message ?? "Введите корректный номер");
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await lookupTrackedOrder(parsed.data);
        setLookupOrders(response.orders);
        setLookupError(null);
      } catch (error) {
        setLookupOrders([]);
        setLookupError(error instanceof Error ? error.message : "Заказ не найден");
      }
    });
  };

  const submitLookup = async () => {
    const query = deferredLookupNumber.trim();
    const isPhoneLookup = isPhoneLookupQuery(query);
    if (query.length === 0) {
      setLookupError("Введите номер заказа, трек-номер или телефон.");
      return;
    }

    startUiTransition(async () => {
      try {
        const response = await lookupTrackedOrder(query);
        setLookupOrders(response.orders);
        setLookupHideSensitiveDetails(isPhoneLookup);
        setLookupError(null);
      } catch (error) {
        setLookupOrders([]);
        setLookupHideSensitiveDetails(false);
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
  const deliveryStepLabel = delivery.result ? "Готово" : "Шаг 1 из 2";
  const hasDeliveryOrders = delivery.orderNumbers.some((value) => value.trim().length > 0);

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
                description="Оформляйте заказы с доставкой в Мариуполь с максимальным комфортом! Надежная выдача товаров из маркетплейсов и транспортных компаний. Приятный бонус - бесплатный возврат, если товар не подошел!"
              />
            </div>
          </div>
          <div className="relative hidden justify-end lg:flex">
            <HeroDeliveryVisual />
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
                accent={card.accent}
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
    const isCdekPaid = paid && activePickup.marketplace === "cdek";
    const isDetmirPaid = paid && activePickup.marketplace === "detmir";
    const isGoldapplePaid = paid && activePickup.marketplace === "goldapple";
    const isLetualPaid = paid && activePickup.marketplace === "letual";
    const isWildberriesPremiumPaid = paid && activePickup.marketplace === "wildberries_premium";
    const isCourierPaid = paid && activePickup.marketplace === "courier";
    const isBulkyPaid = paid && activePickup.marketplace === "bulky";
    const isTrackingCodePaid =
      paid && (activePickup.marketplace === "5post" || activePickup.marketplace === "dpd" || activePickup.marketplace === "avito");
    const usesTrackingPickupFields = isCdekPaid || isTrackingCodePaid;
    const isSpecial = paid && (activePickup.marketplace === "courier" || activePickup.marketplace === "bulky");
    const paidFieldCopy = getPaidFieldCopy(activePickup.marketplace);
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
              filter={paid ? undefined : ["wildberries", "ozon", "yandex_market"]}
            >
              {paid ? (
                <div className="h-full sm:col-span-2 lg:col-span-3 xl:col-start-2 xl:col-span-3">
                  <div className="grid h-full gap-4 sm:grid-cols-2">
                    {specialPickupOptions.map((opt) => {
                      const active = activePickup.marketplace === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updatePickup({ marketplace: opt.id, errors: {} })}
                          className={`marketplace-tile group relative flex h-full min-h-[152px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[28px] border px-5 py-5 text-center transition ${
                            active
                              ? "border-[color:rgba(196,46,160,0.32)] bg-white shadow-[0_20px_44px_rgba(123,77,255,0.18)]"
                              : "border-[rgba(123,77,255,0.2)] bg-[linear-gradient(135deg,rgba(123,77,255,0.05),rgba(196,46,160,0.04))] hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(59,26,110,0.08)]"
                          }`}
                        >
                          {active && (
                            <span className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c42ea0,#7c33ff)] text-xs font-bold text-white shadow-[0_10px_18px_rgba(123,77,255,0.22)]">
                              &#10003;
                            </span>
                          )}
                          <span className="text-3xl">{opt.icon}</span>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-base font-semibold text-[color:var(--foreground)]">{opt.label}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">{opt.sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </MarketplaceGrid>
          </div>
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
          title={paid ? (usesTrackingPickupFields ? "Заполните данные для получения" : "Загрузите код и заполните детали") : "Детали заказа"}
          description={
            paid
              ? isCdekPaid
                ? "Укажите имя, фамилию, телефон и заполните трек-номер или номер отправления ИМ. Код получения и скриншот отправления можно добавить по желанию."
                : isTrackingCodePaid
                  ? "Укажите имя, фамилию, телефон, трек-номер и код получения. Скриншот отправления можно приложить по желанию."
                  : "Заполните данные клиента и загрузите QR или штрих-код. Мы сохраним заказ отдельным сценарием без смешивания со стандартной доставкой."
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

            {isWildberriesPremiumPaid ? (
              <>
                <div className="rounded-[24px] border border-[color:rgba(196,46,160,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,244,255,0.96))] px-5 py-4 text-center text-sm font-semibold leading-7 text-[color:var(--foreground)] shadow-[0_12px_28px_rgba(84,58,128,0.06)]">
                  Только для товаров стоимостью более 20000 р. Доставка оплачивается по тарифной сетке по весу товаров!
                </div>

                <Field label="Укажите стоимость товара" htmlFor={`${activeFlow}-amount`} error={activePickup.errors.totalAmount}>
                  <InputWithSuffix id={`${activeFlow}-amount`} type="number" min="20001" suffix="₽" value={activePickup.totalAmount} onChange={(event) => updatePickup({ totalAmount: event.target.value })} />
                </Field>

                <Field label="Прикрепите скриншот товара" htmlFor={`${activeFlow}-productAttachment`} error={activePickup.errors.productAttachment}>
                  <FileUploadCard
                    id={`${activeFlow}-productAttachment`}
                    accept=".jpg,.jpeg,.png,.pdf"
                    file={activePickup.productAttachment}
                    onChange={(file) => updatePickup({ productAttachment: file })}
                  />
                </Field>

                <Field
                  label="Штрих-код или QR код для получения (Сделайте скриншот и приложите его)"
                  htmlFor={`${activeFlow}-attachment`}
                  error={activePickup.errors.attachment}
                >
                  <FileUploadCard
                    id={`${activeFlow}-attachment`}
                    accept=".jpg,.jpeg,.png,.pdf"
                    file={activePickup.attachment}
                    onChange={(file) => updatePickup({ attachment: file })}
                  />
                </Field>
              </>
            ) : isCdekPaid ? (
              <>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start">
                  <Field
                    label="Укажите трек-номер"
                    htmlFor={`${activeFlow}-trackingNumber`}
                    hint="11 цифр, не больше, не меньше"
                    error={activePickup.errors.trackingNumber}
                  >
                    <Input
                      id={`${activeFlow}-trackingNumber`}
                      inputMode="numeric"
                      maxLength={11}
                      pattern="[0-9]*"
                      placeholder="Введите трек-номер"
                      value={activePickup.trackingNumber}
                      onChange={(event) => updatePickup({ trackingNumber: event.target.value.replace(/\D/g, "").slice(0, 11) })}
                    />
                  </Field>
                  <div className="flex items-center justify-center pt-0 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)] sm:pt-11">
                    или
                  </div>
                  <Field
                    label="Номер отправления ИМ"
                    htmlFor={`${activeFlow}-shipmentNumber`}
                    hint={
                      <>
                        <span className="block font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Без маски</span>
                        <span className="block">
                          Данное поле заполняется, если нет трек-номера СДЭК в формате "10243258828", есть только номер отправления интернет-магазина, например зарубежные посылки "CN0016355297RU9".
                        </span>
                      </>
                    }
                    error={activePickup.errors.shipmentNumber}
                  >
                    <Input
                      id={`${activeFlow}-shipmentNumber`}
                      placeholder="Введите номер отправления ИМ"
                      value={activePickup.shipmentNumber}
                      onChange={(event) => updatePickup({ shipmentNumber: event.target.value })}
                    />
                  </Field>
                </div>

                <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  Обязательно одно из двух полей
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Код получения</span>
                        <span className={fieldStateLabelClass}>
                          Не обязательное поле
                        </span>
                      </span>
                    }
                    htmlFor={`${activeFlow}-pickupCode`}
                    hint={<span className="block">Если подключен СДЭК ID</span>}
                    error={activePickup.errors.pickupCode}
                  >
                    <Input
                      id={`${activeFlow}-pickupCode`}
                      placeholder="Введите код получения"
                      value={activePickup.pickupCode}
                      onChange={(event) => updatePickup({ pickupCode: event.target.value })}
                    />
                  </Field>
                </div>

                <Field
                  label={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Скриншот отправления</span>
                      <span className="text-sm font-semibold text-[color:var(--accent-strong)]">Можно пропустить</span>
                    </span>
                  }
                  htmlFor={`${activeFlow}-attachment`}
                  error={activePickup.errors.attachment}
                >
                  <FileUploadCard
                    id={`${activeFlow}-attachment`}
                    accept=".jpg,.jpeg,.png,.pdf"
                    file={activePickup.attachment}
                    onChange={(file) => updatePickup({ attachment: file })}
                  />
                </Field>
              </>
            ) : isTrackingCodePaid ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Укажите трек-номер" htmlFor={`${activeFlow}-trackingNumber`} error={activePickup.errors.trackingNumber}>
                    <Input
                      id={`${activeFlow}-trackingNumber`}
                      placeholder="Введите трек-номер"
                      value={activePickup.trackingNumber}
                      onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                    />
                  </Field>
                  <Field label="Код получения" htmlFor={`${activeFlow}-pickupCode`} error={activePickup.errors.pickupCode}>
                    <Input
                      id={`${activeFlow}-pickupCode`}
                      placeholder="Введите код получения"
                      value={activePickup.pickupCode}
                      onChange={(event) => updatePickup({ pickupCode: event.target.value })}
                    />
                  </Field>
                </div>

                <Field label={paidFieldCopy.attachmentLabel} htmlFor={`${activeFlow}-attachment`} hint={paidFieldCopy.attachmentHint} error={activePickup.errors.attachment}>
                  <FileUploadCard
                    id={`${activeFlow}-attachment`}
                    accept=".jpg,.jpeg,.png,.pdf"
                    file={activePickup.attachment}
                    onChange={(file) => updatePickup({ attachment: file })}
                  />
                </Field>
              </>
            ) : paid ? (
              <>
                {isDetmirPaid ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Номер заказа</span>
                          <span className={fieldStateLabelClass}>
                            Обязательное поле
                          </span>
                        </span>
                      }
                      htmlFor={`${activeFlow}-trackingNumber`}
                      error={activePickup.errors.trackingNumber}
                    >
                      <Input
                        id={`${activeFlow}-trackingNumber`}
                        placeholder="Введите номер заказа"
                        value={activePickup.trackingNumber}
                        onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                      />
                    </Field>
                    <Field
                      label={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Код получения</span>
                          <span className={fieldStateLabelClass}>
                            Не обязательное поле
                          </span>
                        </span>
                      }
                      htmlFor={`${activeFlow}-pickupCode`}
                      error={activePickup.errors.pickupCode}
                    >
                      <Input
                        id={`${activeFlow}-pickupCode`}
                        placeholder="Введите код получения"
                        value={activePickup.pickupCode}
                        onChange={(event) => updatePickup({ pickupCode: event.target.value })}
                      />
                    </Field>
                  </div>
                ) : null}

                {isGoldapplePaid ? (
                  <div className="mx-auto max-w-[430px]">
                    <Field
                      label={
                        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center sm:justify-start sm:text-left">
                          <span>Номер заказа</span>
                          <span className={fieldStateLabelClass}>
                            Обязательное поле
                          </span>
                        </span>
                      }
                      htmlFor={`${activeFlow}-trackingNumber`}
                      error={activePickup.errors.trackingNumber}
                    >
                      <Input
                        id={`${activeFlow}-trackingNumber`}
                        placeholder="Введите номер заказа"
                        value={activePickup.trackingNumber}
                        onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                      />
                    </Field>
                  </div>
                ) : null}

                {isLetualPaid ? (
                  <div className="mx-auto max-w-[430px]">
                    <Field
                      label={
                        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center sm:justify-start sm:text-left">
                          <span>Номер заказа</span>
                          <span className={fieldStateLabelClass}>
                            Обязательное поле
                          </span>
                        </span>
                      }
                      htmlFor={`${activeFlow}-trackingNumber`}
                      error={activePickup.errors.trackingNumber}
                    >
                      <Input
                        id={`${activeFlow}-trackingNumber`}
                        placeholder="Введите номер заказа"
                        value={activePickup.trackingNumber}
                        onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                      />
                    </Field>
                  </div>
                ) : null}

                {isCourierPaid ? (
                  <>
                    <Field
                      label={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Название отправителя или интернет-магазина</span>
                          <span className={fieldStateLabelClass}>
                            Обязательное поле
                          </span>
                        </span>
                      }
                      htmlFor={`${activeFlow}-senderName`}
                      error={activePickup.errors.senderName}
                    >
                      <Input
                        id={`${activeFlow}-senderName`}
                        placeholder="Например, Ривгош, ИП Петров, ООО “Сарма”"
                        value={activePickup.senderName}
                        onChange={(event) => updatePickup({ senderName: event.target.value })}
                      />
                    </Field>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field
                        label={
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Номер заказа</span>
                            <span className={fieldStateLabelClass}>
                              Не обязательно
                            </span>
                          </span>
                        }
                        htmlFor={`${activeFlow}-trackingNumber`}
                        error={activePickup.errors.trackingNumber}
                      >
                        <Input
                          id={`${activeFlow}-trackingNumber`}
                          placeholder="Введите номер заказа"
                          value={activePickup.trackingNumber}
                          onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                        />
                      </Field>
                      <Field
                        label={
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Код получения</span>
                            <span className={fieldStateLabelClass}>
                              Не обязательно
                            </span>
                          </span>
                        }
                        htmlFor={`${activeFlow}-pickupCode`}
                        error={activePickup.errors.pickupCode}
                      >
                        <Input
                          id={`${activeFlow}-pickupCode`}
                          placeholder="Введите код получения"
                          value={activePickup.pickupCode}
                          onChange={(event) => updatePickup({ pickupCode: event.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={paidFieldCopy.itemCountLabel}
                        htmlFor={`${activeFlow}-count`}
                        hint="Введите общее количество товаров для получения"
                        error={activePickup.errors.itemCount}
                      >
                        <InputWithSuffix id={`${activeFlow}-count`} type="number" min="1" suffix="шт." value={activePickup.itemCount} onChange={(event) => updatePickup({ itemCount: event.target.value })} />
                      </Field>
                      <Field
                        label={paidFieldCopy.totalAmountLabel}
                        htmlFor={`${activeFlow}-amount`}
                        hint="Укажите, пожалуйста, общую сумму всех товаров в заказе"
                        error={activePickup.errors.totalAmount}
                      >
                        <InputWithSuffix id={`${activeFlow}-amount`} type="number" min="1" suffix="₽" value={activePickup.totalAmount} onChange={(event) => updatePickup({ totalAmount: event.target.value })} />
                      </Field>
                    </div>

                    <Field label={paidFieldCopy.attachmentLabel} htmlFor={`${activeFlow}-attachment`} hint={paidFieldCopy.attachmentHint} error={activePickup.errors.attachment}>
                      <FileUploadCard
                        id={`${activeFlow}-attachment`}
                        accept=".jpg,.jpeg,.png,.pdf"
                        file={activePickup.attachment}
                        onChange={(file) => updatePickup({ attachment: file })}
                      />
                    </Field>
                  </>
                ) : isBulkyPaid ? (
                  <>
                    <Field
                      label="Название отправителя или интернет-магазина"
                      htmlFor={`${activeFlow}-senderName`}
                      error={activePickup.errors.senderName}
                    >
                      <Input
                        id={`${activeFlow}-senderName`}
                        placeholder="Например, OZON, WB, ООО “Сарма”, ИП Петров"
                        value={activePickup.senderName}
                        onChange={(event) => updatePickup({ senderName: event.target.value })}
                      />
                    </Field>

                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field
                        label={
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Номер заказа</span>
                            <span className={fieldStateLabelClass}>
                              Не обязательно
                            </span>
                          </span>
                        }
                        htmlFor={`${activeFlow}-trackingNumber`}
                        error={activePickup.errors.trackingNumber}
                      >
                        <Input
                          id={`${activeFlow}-trackingNumber`}
                          placeholder="Введите номер заказа"
                          value={activePickup.trackingNumber}
                          onChange={(event) => updatePickup({ trackingNumber: event.target.value })}
                        />
                      </Field>
                      <Field
                        label={
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Код получения</span>
                            <span className={fieldStateLabelClass}>
                              Не обязательно
                            </span>
                          </span>
                        }
                        htmlFor={`${activeFlow}-pickupCode`}
                        error={activePickup.errors.pickupCode}
                      >
                        <Input
                          id={`${activeFlow}-pickupCode`}
                          placeholder="Введите код получения"
                          value={activePickup.pickupCode}
                          onChange={(event) => updatePickup({ pickupCode: event.target.value })}
                        />
                      </Field>
                    </div>

                    <Field
                      label="QR / штрих-код заказа / скриншоты товаров / грузов"
                      htmlFor={`${activeFlow}-attachment`}
                      hint={paidFieldCopy.attachmentHint}
                      error={activePickup.errors.attachment}
                    >
                      <MultiFileUploadCard
                        id={`${activeFlow}-attachment`}
                        accept=".jpg,.jpeg,.png,.pdf"
                        files={activePickup.bulkyAttachments}
                        maxFiles={bulkyAttachmentLimit}
                        onChange={setBulkyAttachments}
                      />
                      {activePickup.bulkyAttachments.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {activePickup.bulkyAttachments.map((file, index) => (
                            <button
                              key={`${file.name}-${file.lastModified}-${index}`}
                              type="button"
                              onClick={() => removeBulkyAttachment(index)}
                              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] shadow-[0_10px_24px_rgba(84,58,128,0.05)]"
                            >
                              <span className="max-w-[220px] truncate">{file.name}</span>
                              <span className="text-[color:var(--muted)]">×</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </Field>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label={paidFieldCopy.itemCountLabel}
                        htmlFor={`${activeFlow}-count`}
                        hint="Введите общее количество товаров для получения"
                        error={activePickup.errors.itemCount}
                      >
                        <InputWithSuffix id={`${activeFlow}-count`} type="number" min="1" suffix="шт." value={activePickup.itemCount} onChange={(event) => updatePickup({ itemCount: event.target.value })} />
                      </Field>
                      <Field
                        label={paidFieldCopy.totalAmountLabel}
                        htmlFor={`${activeFlow}-amount`}
                        hint="Укажите, пожалуйста, общую сумму всех товаров в заказе"
                        error={activePickup.errors.totalAmount}
                      >
                        <InputWithSuffix id={`${activeFlow}-amount`} type="number" min="1" suffix="₽" value={activePickup.totalAmount} onChange={(event) => updatePickup({ totalAmount: event.target.value })} />
                      </Field>
                    </div>

                    <Field label={paidFieldCopy.attachmentLabel} htmlFor={`${activeFlow}-attachment`} hint={paidFieldCopy.attachmentHint} error={activePickup.errors.attachment}>
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
                          ↑
                        </span>
                        <span className="mt-5 text-lg font-semibold text-[color:var(--foreground)]">
                          {activePickup.attachment ? activePickup.attachment.name : "Нажмите для загрузки"}
                        </span>
                        <span className="mt-2 text-sm text-[color:var(--muted)]">
                          {activePickup.attachment ? "Файл прикреплён. Можно продолжать." : "Поддерживаются изображения и PDF."}
                        </span>
                      </div>
                    </Field>
                  </>
                )}
              </>
            ) : (
              <>
                <Field
                  label={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Укажите размер</span>
                      <span className={fieldStateLabelClass}>Не обязательное поле</span>
                    </span>
                  }
                  htmlFor={`${activeFlow}-size`}
                  error={activePickup.errors.size}
                >
                  <Input
                    id={`${activeFlow}-size`}
                    placeholder="Например, S, M, 42, 42.5, 128 GB"
                    value={activePickup.size}
                    onChange={(event) => updatePickup({ size: event.target.value })}
                  />
                </Field>

                <Field label="Ссылка на товар" htmlFor={`${activeFlow}-sourceUrl`} hint="Ссылка должна соответствовать выбранному маркетплейсу." error={activePickup.errors.sourceUrl}>
                  <Input
                    id={`${activeFlow}-sourceUrl`}
                    placeholder={activePickupSourceUrlPlaceholder}
                    value={activePickup.sourceUrl}
                    onChange={(event) => updatePickup({ sourceUrl: event.target.value })}
                  />
                </Field>
              </>
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
    if (delivery.result) {
      return (
        <SuccessState
          order={delivery.result}
          title="Доставка успешно оформлена!"
          description="Мы сохранили номера заказов, адрес, дату и выбранный интервал доставки. Дальше можно оформить ещё одну доставку или вернуться на главный экран."
          primaryLabel="Создать ещё доставку"
          onPrimary={() => {
            setDelivery(createDeliveryState());
          }}
          secondaryLabel="На главную"
          onSecondary={() => openFlow("overview")}
        />
      );
    }

    return (
      <FlowShell
        eyebrow=""
        title="Доставка на дом"
        description="Введите номера заказов, адрес, дату и выберите удобный интервал доставки."
        stepLabel={deliveryStepLabel}
        align="center"
        className="mx-auto max-w-[820px]"
      >
        <form
          className="mx-auto max-w-[760px] space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDeliveryOrder();
          }}
        >
          <Field
            label="Введите номера заказов для доставки на дом"
            htmlFor="delivery-orderNumbers"
            error={delivery.errors.orderNumbers}
          >
            <div className="space-y-4">
              {delivery.orderNumbers.map((orderNumber, index) => {
                const isLast = index === delivery.orderNumbers.length - 1;
                return (
                  <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_64px] sm:items-center">
                    <Input
                      id={index === 0 ? "delivery-orderNumbers" : undefined}
                      autoFocus={index === 0}
                      inputMode="numeric"
                      placeholder={index === 0 ? "669281" : `Номер заказа ${index + 1}`}
                      value={orderNumber}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          orderNumbers: current.orderNumbers.map((value, valueIndex) => (valueIndex === index ? event.target.value : value)),
                          errors: { ...current.errors, orderNumbers: "" },
                        }))
                      }
                    />
                    {isLast ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDelivery((current) => ({
                            ...current,
                            orderNumbers: [...current.orderNumbers, ""],
                          }))
                        }
                        className="inline-flex h-14 w-14 shrink-0 items-center justify-center self-start rounded-[22px] border border-[color:rgba(196,46,160,0.24)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,244,255,0.96))] text-[30px] font-semibold leading-none text-[color:var(--accent-strong)] shadow-[0_14px_28px_rgba(123,77,255,0.12)] transition hover:border-[color:rgba(196,46,160,0.38)] hover:shadow-[0_18px_34px_rgba(123,77,255,0.18)] sm:self-auto"
                        aria-label="Добавить ещё заказ"
                      >
                        +
                      </button>
                    ) : (
                      <div className="hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </Field>

          {hasDeliveryOrders ? (
            <>
              <Field label="Укажите адрес доставки" htmlFor="delivery-address" error={delivery.errors.deliveryAddress}>
                <Textarea
                  id="delivery-address"
                  placeholder="Укажите полный адрес с улицей, домом и квартирой"
                  className="min-h-[128px]"
                  value={delivery.deliveryAddress}
                  onChange={(event) => setDelivery((current) => ({ ...current, deliveryAddress: event.target.value }))}
                />
              </Field>

              <Field label="Укажите желаемую дату доставки" htmlFor="delivery-date" error={delivery.errors.deliveryDate}>
                <Input
                  id="delivery-date"
                  type="date"
                  value={delivery.deliveryDate}
                  onChange={(event) => setDelivery((current) => ({ ...current, deliveryDate: event.target.value }))}
                />
              </Field>

              <Field label="Выберите промежуток времени" htmlFor="delivery-timeSlot" error={delivery.errors.deliveryTimeSlot}>
                <div id="delivery-timeSlot" className="grid gap-3 sm:grid-cols-3">
                  {homeDeliveryTimeSlotValues.map((slot) => {
                    const active = delivery.deliveryTimeSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setDelivery((current) => ({ ...current, deliveryTimeSlot: slot, errors: { ...current.errors, deliveryTimeSlot: "" } }))}
                        className={`min-h-14 rounded-[22px] border px-4 py-4 text-sm font-semibold transition ${
                          active
                            ? "border-[color:rgba(196,46,160,0.32)] bg-white text-[color:var(--foreground)] shadow-[0_16px_32px_rgba(123,77,255,0.16)]"
                            : "border-[color:var(--line)] bg-[color:var(--surface-subtle)] text-[color:var(--muted)] hover:border-[color:rgba(123,77,255,0.18)] hover:bg-white"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          ) : null}

          {delivery.errors.form ? (
            <div className="rounded-[24px] border border-[color:rgba(220,38,38,0.16)] bg-[rgba(220,38,38,0.06)] px-5 py-4 text-sm font-semibold text-[color:var(--danger)]">
              {delivery.errors.form}
            </div>
          ) : null}

          {hasDeliveryOrders ? (
            <div className="flex justify-end pt-4">
              <PrimaryButton type="submit" disabled={pending} className="min-h-14 min-w-[180px] px-6">
                {pending ? "Создаём..." : "Продолжить"}
              </PrimaryButton>
            </div>
          ) : null}
        </form>
      </FlowShell>
    );
  };

  const renderLookupFlow = () => (
    <section className="mx-auto max-w-[920px]">
      <SectionIntro
        eyebrow=""
        title="Отследить посылку"
        description="Введите номер отслеживания или номер заказа, чтобы мгновенно узнать текущий статус доставки."
        centered
      />
      <div className="mt-8 rounded-[34px] border border-white/70 bg-white/92 p-4 shadow-[0_24px_60px_rgba(84,58,128,0.1)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="lookup-order"
            autoFocus
            inputMode="text"
            placeholder="ID заказа или +7 (___) ___-__-__"
            value={lookupNumber}
            onChange={(event) => setLookupNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitLookup();
              }
            }}
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
        {lookupOrders.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] bg-white/88 px-5 py-4 shadow-[0_10px_24px_rgba(84,58,128,0.05)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Результаты поиска</p>
                <p className="mt-1 text-sm text-[color:var(--foreground)]">
                  Найдено заказов: <span className="font-semibold">{lookupOrders.length}</span>
                </p>
              </div>
              <div className="rounded-full bg-[color:var(--surface-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
                {lookupHideSensitiveDetails ? "Поиск по телефону" : lookupOrders[0]?.customer.phone}
              </div>
            </div>
            {lookupOrders.map((order) => (
              <OrderSummaryCard key={order.id} order={order} compact hideSensitiveDetails={lookupHideSensitiveDetails} />
            ))}
          </div>
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

  const courierRates = [
    { w: "До 9,9 кг", p: "450 ₽" },
    { w: "10–29,9 кг", p: "700 ₽" },
    { w: "30–99,9 кг", p: "900 ₽" },
    { w: "100–149,9 кг", p: "1 000 ₽" },
    { w: "150–199,9 кг", p: "1 100 ₽" },
    { w: "200–299,9 кг", p: "1 200 ₽" },
    { w: "300–399,9 кг", p: "1 300 ₽" },
    { w: "400–499,9 кг", p: "1 500 ₽" },
  ];

  const shipRussiaAdvantages = [
    "Без очередей и лишних действий",
    "Упаковка на месте",
    "Отслеживание каждой посылки",
    "Страхование грузов",
    "Индивидуальный подход",
  ];

  const shipRussiaPackaging = [
    "Коробки всех размеров",
    "Пузырчатая плёнка",
    "Скотч и защита груза",
    "Помощь сотрудников",
  ];

  const shipRussiaAllowed = ["Документы", "Личные вещи", "Мелкую технику", "Подарки", "Хрупкие грузы", "Сувениры (с документами)"];

  const shipRussiaForbidden = ["Оружие и взрывчатые вещества", "Жидкости и химикаты", "Продукты питания", "Алкоголь и сигареты", "Лекарства", "Деньги"];

  const shipRussiaDeliveryControl = ["Отслеживание по трек-номеру", "Уведомления о статусе", "Доставка до пункта или курьером"];

  const shipRussiaProtection = ["Страхование посылок", "Компенсация при утере или повреждении", "Спокойствие за груз"];

  const shipRussiaPayment = ["При отправке", "При получении", "Без наложенного платежа"];

  const shipRussiaSteps = [
    "Вы приносите посылку",
    "Мы проверяем и упаковываем",
    "Оформляем отправление",
    "Вы получаете трек-номер",
    "Доставка получателю",
  ];

  const renderShipRussiaFlow = () => (
    <section className="mx-auto w-full max-w-[1180px] space-y-6">
      <section className="soft-card overflow-hidden rounded-[36px] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-strong)]">Отправка по России из ДНР</p>
            <h1 className="mt-5 font-[family-name:var(--font-display)] text-4xl leading-[0.95] text-[color:var(--foreground)] sm:text-5xl lg:text-6xl">
              Отправка посылок по России
            </h1>
            <p className="mt-5 text-xl font-semibold text-[color:var(--foreground)]">Быстро. Без очередей. В одном месте.</p>
            <p className="mt-4 text-base leading-8 text-[color:var(--muted)]">
              Отправляйте документы, вещи и технику по всей России через удобный сервис «одного окна».
            </p>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-main-pastel.png"
                alt="Доставка по России в пастельных тонах"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Почему выбирают нас</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Сервис без очередей и лишней суеты
            </h2>
            <div className="mt-6 grid gap-3">
              {shipRussiaAdvantages.map((item) => (
                <div key={item} className="rounded-[22px] bg-[color:var(--surface-soft)] px-4 py-3 text-base font-medium text-[color:var(--foreground)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-pastel-packing-station.png"
                alt="Станция упаковки в пастельных тонах"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Подготовка отправления</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Мы полностью подготовим вашу посылку к отправке
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {shipRussiaPackaging.map((item) => (
                <div key={item} className="rounded-[24px] border border-[color:var(--line)] bg-white/92 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">В наличии</p>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--foreground)]">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-purple-packing-materials.png"
                alt="Упаковочные материалы с фиолетовыми акцентами"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Что можно отправить</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Допустимые категории отправлений
            </h2>
            <div className="mt-6 grid gap-3">
              {shipRussiaAllowed.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[22px] bg-[color:var(--surface-soft)] px-4 py-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm text-[color:var(--accent-strong)] shadow-[0_8px_18px_rgba(84,58,128,0.06)]">
                    ✓
                  </span>
                  <span className="text-base font-medium text-[color:var(--foreground)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-allowed-items-111.png"
                alt="Разрешённые категории отправлений"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[rgba(239,68,68,0.16)] bg-[linear-gradient(135deg,rgba(255,248,248,0.94),rgba(255,255,255,0.9))] px-6 py-7 shadow-[0_18px_40px_rgba(239,68,68,0.06)] sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:#c2410c]">Что нельзя отправлять</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Запрещённые категории
            </h2>
            <div className="mt-6 grid gap-3">
              {shipRussiaForbidden.map((item) => (
                <div key={item} className="rounded-[22px] border border-[rgba(239,68,68,0.12)] bg-white/88 px-4 py-3 text-base font-medium text-[color:var(--foreground)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-restricted-items-222.png"
                alt="Ограничения на отправку"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Контроль доставки</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Полный контроль и защита отправлений
            </h2>
            <div className="mt-6 grid gap-4">
              <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Полный контроль доставки</p>
                <ul className="mt-4 space-y-3 text-base leading-7 text-[color:var(--foreground)]">
                  {shipRussiaDeliveryControl.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] bg-[color:var(--surface-soft)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Защита ваших отправлений</p>
                <ul className="mt-4 space-y-3 text-base leading-7 text-[color:var(--foreground)]">
                  {shipRussiaProtection.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.07)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:#b45309]">Удобная оплата</p>
                <ul className="mt-4 space-y-3 text-base leading-7 text-[color:var(--foreground)]">
                  {shipRussiaPayment.map((item) => (
                    <li key={item}>{item === "Без наложенного платежа" ? "❗️ Без наложенного платежа" : `• ${item}`}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="relative min-h-[320px] lg:min-h-full">
            <div className="relative h-full min-h-[320px]">
              <Image
                src="/ship-russia-tracking-protection.png"
                alt="Доставка под защитой и отслеживанием"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Как это работает</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Путь отправления шаг за шагом
            </h2>
            <div className="mt-6 grid gap-3">
              {shipRussiaSteps.map((item, index) => (
                <div key={item} className="flex items-center gap-4 rounded-[24px] bg-[color:var(--surface-soft)] px-4 py-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[color:var(--accent-strong)] shadow-[0_10px_22px_rgba(84,58,128,0.08)]">
                    {index + 1}
                  </span>
                  <span className="text-base font-medium text-[color:var(--foreground)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-h-[340px] items-center justify-center lg:min-h-full">
            <div className="relative h-[360px] w-full max-w-[430px] sm:h-[390px] lg:h-[430px] lg:max-w-[470px]">
              <Image
                src="/ship-russia-step-by-step-photoroom.png"
                alt="Процесс доставки шаг за шагом"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flow-surface rounded-[32px] px-6 py-7 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)]">Контакты</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none text-[color:var(--foreground)] sm:text-4xl">
              Остались вопросы?
            </h2>
            <div className="mt-6 grid gap-3">
              <div className="rounded-[22px] bg-[color:var(--surface-soft)] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Написать прямо сейчас</p>
                <p className="mt-2 text-base leading-7 text-[color:var(--foreground)]">
                  Свяжитесь с нами в Telegram и получите консультацию по отправке.
                </p>
              </div>
              <div className="rounded-[22px] bg-[color:var(--surface-soft)] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Позвонить</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--foreground)]">+7 (949) 854-27-85</p>
              </div>
              <div className="rounded-[22px] border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.07)] px-4 py-4">
                <p className="text-lg font-semibold text-[color:var(--foreground)]">Отправьте посылку уже сегодня</p>
                <p className="mt-2 text-base leading-7 text-[color:var(--foreground)]">
                  Быстро оформим, надежно упакуем и доставим по России.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative aspect-[1.16/1]">
              <Image
                src="/ship-russia-contact-333.png"
                alt="Контакты и доставка"
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>
    </section>
  );

  const percentageTariffRows = [
    [
      { label: "OZON", value: "Бесплатно" },
      { label: "Wildberries", value: "8%" },
      { label: "Яндекс Маркет", value: "10%" },
    ],
    [
      { label: "Lamoda", value: "10%" },
      { label: "Золотое Яблоко", value: "10%" },
      { label: "Лэтуаль", value: "10%" },
    ],
  ];

  const renderTariffsView = () => (
    <section className="mx-auto w-full max-w-[1100px] space-y-6">
      <div className="flow-surface float-in rounded-[28px] p-6">
        <div className="mb-4 border-b border-[color:var(--line)] pb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)] sm:text-sm">
            Тарифы
          </p>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent-strong)] sm:text-base">
              Тарифы · % от стоимости товара
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <tbody>
              {percentageTariffRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex % 2 === 0 ? "" : "bg-[color:var(--surface-soft)]"}>
                  {row.map((cell) => (
                    <Fragment key={cell.label}>
                      <th className="border-b border-r border-[color:var(--line)] px-4 py-3 text-left text-[color:var(--foreground)] sm:px-5 sm:text-base">
                        {cell.label}
                      </th>
                      <td className="border-b border-r border-[color:var(--line)] px-4 py-3 text-right font-semibold text-[color:var(--foreground)] last:border-r-0 sm:px-5">
                        {cell.value}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
              <tr className="bg-[color:var(--surface-soft)]">
                <th className="border-r border-[color:var(--line)] px-4 py-3 text-left text-[color:var(--foreground)] sm:px-5 sm:text-base">
                  Детский Мир
                </th>
                <td className="border-r border-[color:var(--line)] px-4 py-3 text-right font-semibold text-[color:var(--foreground)] sm:px-5">
                  10%
                </td>
                <th colSpan={3} className="border-r border-[color:var(--line)] px-4 py-3 text-center text-[color:var(--foreground)] sm:px-5 sm:text-base">
                  Прочие интернет-магазины
                </th>
                <td className="px-4 py-3 text-right font-semibold text-[color:var(--foreground)] sm:px-5">15%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="float-in text-center">
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none text-[color:var(--foreground)] sm:text-5xl">
          Весовые тарифы
        </h2>
        <p className="mt-4 text-lg font-semibold leading-8 text-[color:var(--accent-strong)] sm:text-[1.85rem]">
          WB Дорогостой · WB ОПТ · СДЭК · Авито · DPD
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

        <div className="flex flex-col gap-5">
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

          <div className="flow-surface float-in rounded-[28px] p-6" style={{ animationDelay: "120ms" }}>
            <div className="mb-4 border-b border-[color:var(--line)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">Курьерская доставка</p>
              <p className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">Тариф по городу</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  <th className="pb-2 text-left font-semibold">Вес</th>
                  <th className="pb-2 text-right font-semibold">Цена</th>
                </tr>
              </thead>
              <tbody>
                {courierRates.map((row, i) => (
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
    if (activeFlow === "ship_russia") return renderShipRussiaFlow();
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

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openFlow("ship_russia")}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5 hover:border-[rgba(16,185,129,0.28)] hover:shadow-[0_10px_24px_rgba(16,185,129,0.1)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sm shadow-[0_8px_18px_rgba(84,58,128,0.08)]">
                🚚
              </span>
              <span className="hidden lg:inline">Отправить по РФ</span>
            </button>

            <button
              type="button"
              onClick={() => openFlow("order_lookup")}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(59,130,246,0.18)] bg-[rgba(59,130,246,0.08)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5 hover:border-[rgba(59,130,246,0.3)] hover:shadow-[0_10px_24px_rgba(59,130,246,0.1)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sm shadow-[0_8px_18px_rgba(84,58,128,0.08)]">
                ⌕
              </span>
              <span className="hidden sm:inline">Отследить</span>
            </button>

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
