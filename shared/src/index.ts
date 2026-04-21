import { z } from "zod";

export const pickupAddress = "ДНР, г. Мариуполь, ул. Грушевского, 8 ПН-СБ с 10:00 до 19:00";
export const supportTelegramUrl =
  process.env.NEXT_PUBLIC_SUPPORT_URL ?? process.env.SUPPORT_URL ?? "https://t.me/priemzakazovsuperbox";
export const bulkyAttachmentLimit = 10;

export const marketplaces = [
  {
    id: "cdek",
    label: "СДЭК",
    asset: "сдэк.svg",
    parserMode: "fallback",
    domains: [],
  },
  {
    id: "5post",
    label: "5POST",
    asset: "5-post.jpg",
    parserMode: "fallback",
    domains: [],
  },
  {
    id: "dpd",
    label: "DPD",
    asset: "dpd.jpg",
    parserMode: "fallback",
    domains: [],
  },
  {
    id: "avito",
    label: "Avito",
    asset: "avito.jpeg",
    parserMode: "supported",
    domains: ["avito.ru", "www.avito.ru"],
  },
  {
    id: "wildberries",
    label: "WILDBERRIES",
    asset: "wb.jpg",
    parserMode: "supported",
    domains: ["wildberries.ru", "www.wildberries.ru"],
  },
  {
    id: "wildberries_opt",
    label: "WILDBERRIES ОПТ",
    asset: "WB ОПТ.png",
    parserMode: "supported",
    domains: ["wildberries.ru", "www.wildberries.ru"],
  },
  {
    id: "wildberries_premium",
    label: "WILDBERRIES Дорогостой",
    asset: "WB Дорогостой.png",
    parserMode: "supported",
    domains: ["wildberries.ru", "www.wildberries.ru"],
  },
  {
    id: "ozon",
    label: "OZON",
    asset: "ozon.png",
    parserMode: "supported",
    domains: ["ozon.ru", "www.ozon.ru"],
  },
  {
    id: "yandex_market",
    label: "Яндекс.Маркет",
    asset: "Yandex_Market.png",
    parserMode: "supported",
    domains: ["market.yandex.ru", "yandex.ru"],
  },
  {
    id: "lamoda",
    label: "LAMODA",
    asset: "lamoda.png",
    parserMode: "supported",
    domains: ["lamoda.ru", "www.lamoda.ru"],
  },
  {
    id: "goldapple",
    label: "Золотое Яблоко",
    asset: "золотое яблоко.webp",
    parserMode: "supported",
    domains: ["goldapple.ru", "www.goldapple.ru"],
  },
  {
    id: "letual",
    label: "Лэтуаль",
    asset: "letual.avif",
    parserMode: "supported",
    domains: ["letu.ru", "www.letu.ru"],
  },
  {
    id: "detmir",
    label: "Детский Мир",
    asset: "детский мир.png",
    parserMode: "supported",
    domains: ["detmir.ru", "www.detmir.ru"],
  },
] as const;

export type MarketplaceId = (typeof marketplaces)[number]["id"];
export type MarketplaceDefinition = (typeof marketplaces)[number];

export const marketplaceById = Object.fromEntries(
  marketplaces.map((marketplace) => [marketplace.id, marketplace]),
) as Record<MarketplaceId, MarketplaceDefinition>;

export const marketplaceExampleUrls: Record<MarketplaceId, string> = {
  cdek: "https://cdek.shopping/product/sony-playstation-5-slim",
  "5post": "https://fivepost.market/product/umnaya-kolonka",
  dpd: "https://market.dpd.ru/product/besprovodnye-naushniki",
  avito: "https://www.avito.ru/moskva/telefony/iphone_15_1234567890",
  wildberries: "https://www.wildberries.ru/catalog/123456789/detail.aspx",
  wildberries_opt: "https://www.wildberries.ru/catalog/123456789/detail.aspx",
  wildberries_premium: "https://www.wildberries.ru/catalog/123456789/detail.aspx",
  ozon: "https://www.ozon.ru/product/besprovodnye-naushniki-123456789/",
  yandex_market: "https://market.yandex.ru/product--besprovodnye-naushniki/123456789",
  lamoda: "https://www.lamoda.ru/p/mp002xw0abcd/",
  goldapple: "https://goldapple.ru/19000123456-uvlazhnjajuschij-krem",
  letual: "https://www.letu.ru/product/parfyumernaya-voda/12345678",
  detmir: "https://www.detmir.ru/product/index/id/1234567/",
};

export const pickupPointOptions = [
  { id: "grushevskogo_mariupol", label: "Мариуполь, улица 60 лет СССР, дом 8" },
  { id: "chelyuskintsev_donetsk", label: "Донецк, улица Челюскинцев 184" },
  { id: "kubysheva_warehouse", label: "Донецк, улица Куйбышева 70/13" },
  { id: "mendeleeva_volnovakha", label: "Волноваха, ул. Менделеева 14" },
  { id: "ostrovskogo_makeevka", label: "Макеевка, ул. Островского 3/18" },
] as const;

export type PickupPointId = (typeof pickupPointOptions)[number]["id"];
export type PickupPointDefinition = (typeof pickupPointOptions)[number];

export const pickupPointById = Object.fromEntries(
  pickupPointOptions.map((pickupPoint) => [pickupPoint.id, pickupPoint]),
) as Record<PickupPointId, PickupPointDefinition>;

export const defaultPickupPointId = "grushevskogo_mariupol" as const;
export const pickupPointSchema = z.enum(pickupPointOptions.map((pickupPoint) => pickupPoint.id) as [PickupPointId, ...PickupPointId[]]);

export const homeDeliveryMarketplaceId = "home_delivery" as const;
export const paidSpecialMarketplaceIds = ["courier", "bulky"] as const;
export type PaidSpecialMarketplaceId = (typeof paidSpecialMarketplaceIds)[number];
export const paidSpecialMarketplaceSchema = z.enum(paidSpecialMarketplaceIds);
export type OrderMarketplaceId = MarketplaceId | PaidSpecialMarketplaceId | typeof homeDeliveryMarketplaceId;

export const homeDeliveryTimeSlotValues = ["9:00-12:00", "12:00-15:00", "15:00-18:00"] as const;
export type HomeDeliveryTimeSlot = (typeof homeDeliveryTimeSlotValues)[number];

export const orderTypeValues = ["pickup_standard", "pickup_paid", "home_delivery"] as const;
export type OrderType = (typeof orderTypeValues)[number];

export const orderStatusValues = [
  "CREATED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof orderStatusValues)[number];

export const crmSyncStateValues = ["pending", "queued", "synced", "mock_delivered", "failed"] as const;
export type CrmSyncState = (typeof crmSyncStateValues)[number];

export const bitrixStageLabels = {
  NEW: "Новые заказы",
  PREPARATION: "самостоятельные заказы",
  PREPAYMENT_INVOICE: "необходима предоплата",
  EXECUTING: "заказ оформлен в маркетплейсе",
  FINAL_INVOICE: "заказ поступил на пвз ростов",
  UC_6K3CY6: "отправлен в мариуполь",
  UC_FBIO6R: "заказ готов к выдаче",
  UC_VF84A3: "принят в мариуполе",
  WON: "сделка успешно завершена",
  LOSE: "сделка отменена",
  APOLOGY: "заказ отменён",
} as const;

export const attachmentMimeTypes = ["image/jpeg", "image/png", "application/pdf"] as const;
export const attachmentExtensions = [".jpg", ".jpeg", ".png", ".pdf"] as const;

export const phoneSchema = z.string().regex(/^\+7\d{10}$/, "Телефон должен быть в формате +7XXXXXXXXXX");
export const numericIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Введите корректный номер заказа");

export const marketplaceSchema = z.enum(marketplaces.map((marketplace) => marketplace.id) as [MarketplaceId, ...MarketplaceId[]]);
export const orderMarketplaceSchema = z.union([marketplaceSchema, paidSpecialMarketplaceSchema, z.literal(homeDeliveryMarketplaceId)]);
export const orderTypeSchema = z.enum(orderTypeValues);
export const orderStatusSchema = z.enum(orderStatusValues);
export const crmSyncStateSchema = z.enum(crmSyncStateValues);
export const homeDeliveryTimeSlotSchema = z.enum(homeDeliveryTimeSlotValues);

export const baseCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Укажите имя"),
  lastName: z.string().trim().min(1, "Укажите фамилию").optional(),
  phone: phoneSchema,
});

export const productPreviewSchema = z.object({
  title: z.string().trim().min(1),
  price: z.number().nonnegative().nullable(),
  imageUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  parserMode: z.enum(["parsed", "fallback"]),
  parserMessage: z.string().trim().min(1),
});

export type ProductPreview = z.infer<typeof productPreviewSchema>;

export const createPaidPickupOrderSchema = z
  .object({
    orderType: z.literal("pickup_paid"),
    marketplace: z.union([marketplaceSchema, paidSpecialMarketplaceSchema]),
    pickupPoint: pickupPointSchema.default(defaultPickupPointId),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    phone: phoneSchema,
    itemCount: z.number().int().positive("Укажите количество товаров").optional(),
    totalAmount: z.number().positive("Укажите сумму заказа").optional(),
    trackingNumber: z.string().trim().optional(),
    shipmentNumber: z.string().trim().optional(),
    senderName: z.string().trim().optional(),
    pickupCode: z.string().trim().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.marketplace === "cdek") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (!payload.trackingNumber && !payload.shipmentNumber) {
        ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Заполните трек-номер или номер отправления ИМ" });
        ctx.addIssue({ code: "custom", path: ["shipmentNumber"], message: "Заполните трек-номер или номер отправления ИМ" });
      }
      if (payload.trackingNumber && !/^\d{11}$/.test(payload.trackingNumber)) {
        ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Трек-номер должен состоять ровно из 11 цифр" });
      }
      return;
    }

    if (payload.marketplace === "5post" || payload.marketplace === "dpd" || payload.marketplace === "avito") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (!payload.trackingNumber) {
        ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Укажите трек-номер" });
      }
      if (!payload.pickupCode) {
        ctx.addIssue({ code: "custom", path: ["pickupCode"], message: "Укажите код получения" });
      }
      return;
    }

    if (payload.marketplace === "detmir" || payload.marketplace === "goldapple" || payload.marketplace === "letual") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (!payload.trackingNumber) {
        ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Укажите номер заказа" });
      }
      if (payload.itemCount == null) {
        ctx.addIssue({ code: "custom", path: ["itemCount"], message: "Укажите количество товаров" });
      }
      if (payload.totalAmount == null) {
        ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "Укажите сумму заказа" });
      }
      return;
    }

    if (payload.marketplace === "wildberries_premium") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (payload.totalAmount == null) {
        ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "Укажите стоимость товара" });
      }
      return;
    }

    if (payload.marketplace === "bulky") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (!payload.senderName) {
        ctx.addIssue({ code: "custom", path: ["senderName"], message: "Укажите название отправителя или интернет-магазина" });
      }
      return;
    }

    if (payload.marketplace === "courier") {
      if (!payload.firstName) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
      }
      if (!payload.lastName) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
      }
      if (!payload.senderName) {
        ctx.addIssue({ code: "custom", path: ["senderName"], message: "Укажите название отправителя или интернет-магазина" });
      }
      if (payload.itemCount == null) {
        ctx.addIssue({ code: "custom", path: ["itemCount"], message: "Укажите количество товаров" });
      }
      if (payload.totalAmount == null) {
        ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "Укажите сумму заказа" });
      }
      return;
    }

    if (!payload.firstName) {
      ctx.addIssue({ code: "custom", path: ["firstName"], message: "Укажите имя" });
    }
    if (!payload.lastName) {
      ctx.addIssue({ code: "custom", path: ["lastName"], message: "Укажите фамилию" });
    }
    if (payload.itemCount == null) {
      ctx.addIssue({ code: "custom", path: ["itemCount"], message: "Укажите количество товаров" });
    }
    if (payload.totalAmount == null) {
      ctx.addIssue({ code: "custom", path: ["totalAmount"], message: "Укажите сумму заказа" });
    }
  });

export const createPickupOrderSchema = z.object({
  orderType: z.literal("pickup_paid"),
  marketplace: marketplaceSchema,
  firstName: z.string().trim().min(1, "Укажите имя"),
  lastName: z.string().trim().min(1, "Укажите фамилию"),
  phone: phoneSchema,
  itemCount: z.number().int().positive("Укажите количество товаров"),
  totalAmount: z.number().positive("Укажите сумму заказа"),
});

export const createPickupStandardOrderSchema = z.object({
  orderType: z.literal("pickup_standard"),
  marketplace: marketplaceSchema,
  pickupPoint: pickupPointSchema.default(defaultPickupPointId),
  firstName: z.string().trim().min(1, "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0438\u043c\u044f"),
  lastName: z.string().trim().min(1, "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0444\u0430\u043c\u0438\u043b\u0438\u044e"),
  phone: phoneSchema,
  size: z.string().trim().min(1).max(120, "\u0420\u0430\u0437\u043c\u0435\u0440 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u044b\u0439").optional(),
  sourceUrl: z.string().url("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443"),
});

export const createHomeDeliveryOrderSchema = z.object({
  orderType: z.literal("home_delivery"),
  orderNumbers: z.array(numericIdSchema).min(1, "Введите номера заказов для доставки на дом"),
  deliveryAddress: z.string().trim().min(1, "Укажите адрес доставки"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите желаемую дату доставки"),
  deliveryTimeSlot: homeDeliveryTimeSlotSchema,
});

export const createOrderSchema = z.discriminatedUnion("orderType", [
  createPickupStandardOrderSchema,
  createPaidPickupOrderSchema,
  createHomeDeliveryOrderSchema,
]);

export const cancelOrderSchema = z.object({
  orderNumber: numericIdSchema,
});

export const previewLinkSchema = z.object({
  marketplace: marketplaceSchema,
  url: z.string().url("Введите корректную ссылку"),
});

export const orderAttachmentSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  mimeType: z.enum(attachmentMimeTypes),
  size: z.number().positive(),
});

export const customerSchema = z.object({
  firstName: z.string(),
  lastName: z.string().nullable(),
  phone: phoneSchema,
});

export const orderEventSchema = z.object({
  type: z.enum(["created", "cancelled", "status_changed", "bitrix_mocked", "bitrix_synced", "bitrix_sync_failed"]),
  at: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: numericIdSchema,
  orderType: orderTypeSchema,
  marketplace: orderMarketplaceSchema,
  status: orderStatusSchema,
  pickupAddress: z.string(),
  pickupPoint: pickupPointSchema.nullable().default(null),
  customer: customerSchema,
  relatedOrderNumbers: z.array(numericIdSchema).default([]),
  itemCount: z.number().int().positive().nullable(),
  totalAmount: z.number().positive().nullable(),
  trackingNumber: z.string().trim().min(1).nullable().default(null),
  shipmentNumber: z.string().trim().min(1).nullable().default(null),
  senderName: z.string().trim().min(1).nullable().default(null),
  pickupCode: z.string().trim().min(1).nullable().default(null),
  size: z.string().trim().min(1).nullable().default(null),
  sourceUrl: z.string().url().nullable(),
  deliveryAddress: z.string().nullable(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  deliveryTimeSlot: homeDeliveryTimeSlotSchema.nullable().default(null),
  productPreview: productPreviewSchema.nullable(),
  attachment: orderAttachmentSchema.nullable(),
  productAttachment: orderAttachmentSchema.nullable().default(null),
  bulkyAttachments: z.array(orderAttachmentSchema).default([]),
  crmSyncState: crmSyncStateSchema.default("pending"),
  crmContactId: z.string().trim().min(1).nullable().default(null),
  crmDealId: z.string().trim().min(1).nullable().default(null),
  crmStageId: z.string().trim().min(1).nullable().default(null),
  crmStageName: z.string().trim().min(1).nullable().default(null),
  events: z.array(orderEventSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OrderRecord = z.infer<typeof orderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type PreviewLinkInput = z.infer<typeof previewLinkSchema>;

export const createOrderResponseSchema = z.object({
  order: orderSchema,
  message: z.string(),
});

export const cancelOrderResponseSchema = z.object({
  order: orderSchema,
  message: z.string(),
});

export const previewLinkResponseSchema = z.object({
  marketplace: marketplaceSchema,
  preview: productPreviewSchema.nullable(),
  mode: z.enum(["parsed", "fallback"]),
  message: z.string(),
});

export const bitrixPayloadSchema = z.object({
  orderNumber: z.string(),
  orderType: z.string(),
  marketplace: z.string(),
  status: z.string(),
  pickupAddress: z.string(),
  pickupPoint: z.string().nullable().default(null),
  customer: z.object({
    fullName: z.string(),
    phone: z.string(),
  }),
  logistics: z.object({
    sourceUrl: z.string().nullable(),
    deliveryAddress: z.string().nullable(),
    relatedOrderNumbers: z.array(z.string()).default([]),
    deliveryDate: z.string().nullable().default(null),
    deliveryTimeSlot: z.string().nullable().default(null),
    trackingNumber: z.string().nullable().default(null),
    shipmentNumber: z.string().nullable().default(null),
    senderName: z.string().nullable().default(null),
    pickupCode: z.string().nullable().default(null),
    size: z.string().nullable().default(null),
  }),
  pricing: z.object({
    itemCount: z.number().nullable(),
    totalAmount: z.number().nullable(),
    deliveryFee: z.number().nullable(),
  }),
  productPreview: productPreviewSchema.nullable(),
});

export function mapBitrixStageToOrderStatus(stageId: string | null | undefined): OrderStatus | null {
  const normalizedStageId = normalizeBitrixStageId(stageId);
  if (!normalizedStageId) {
    return null;
  }

  switch (normalizedStageId) {
    case "NEW":
      return "CREATED";
    case "UC_6K3CY6":
      return "OUT_FOR_DELIVERY";
    case "UC_FBIO6R":
      return "READY_FOR_PICKUP";
    case "UC_VF84A3":
    case "WON":
      return "COMPLETED";
    case "LOSE":
    case "APOLOGY":
      return "CANCELLED";
    default:
      return "PROCESSING";
  }
}

export function humanizeBitrixStage(stageId: string | null | undefined) {
  const normalizedStageId = normalizeBitrixStageId(stageId);
  if (!normalizedStageId) {
    return null;
  }

  return bitrixStageLabels[normalizedStageId as keyof typeof bitrixStageLabels] ?? stageId;
}

export function humanizePickupPoint(pickupPoint: PickupPointId) {
  return pickupPointById[pickupPoint].label;
}

function normalizeBitrixStageId(stageId: string | null | undefined) {
  if (!stageId) {
    return null;
  }

  const normalized = stageId.trim();
  if (!normalized) {
    return null;
  }

  const [, suffix = normalized] = normalized.split(":");
  return suffix;
}

export function getMarketplaceByHost(host: string): MarketplaceDefinition | null {
  return marketplaces.find((marketplace) => (marketplace.domains as readonly string[]).includes(host)) ?? null;
}

export function supportsParsing(marketplace: MarketplaceId) {
  return marketplaceById[marketplace].parserMode === "supported";
}

export function isSupportedDomainForMarketplace(url: string, marketplace: MarketplaceId) {
  const hostname = new URL(url).hostname.toLowerCase();
  const allowed = marketplaceById[marketplace].domains as readonly string[];
  return allowed.length === 0 ? false : allowed.includes(hostname);
}

export function isAllowedDomainForMarketplace(url: string, marketplace: MarketplaceId) {
  const hostname = new URL(url).hostname.toLowerCase();
  const allowed = marketplaceById[marketplace].domains as readonly string[];
  return allowed.length === 0 ? true : allowed.includes(hostname);
}

export function humanizeMarketplace(marketplace: OrderMarketplaceId) {
  if (marketplace === homeDeliveryMarketplaceId) {
    return "Доставка на дом";
  }
  if (marketplace === "courier") {
    return "Отправлю курьера";
  }
  if (marketplace === "bulky") {
    return "Крупногабарит";
  }
  return marketplaceById[marketplace].label;
}

export function buildManualPreview(url: string, marketplace: MarketplaceId): ProductPreview {
  const slug = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "товар");
  const title = slug
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .trim();

  return {
    title: title.length > 0 ? title : `Товар из ${humanizeMarketplace(marketplace)}`,
    price: null,
    imageUrl: null,
    sourceUrl: url,
    parserMode: "fallback",
    parserMessage: "Не удалось надежно распарсить карточку. Ссылка сохранена для менеджера.",
  };
}
