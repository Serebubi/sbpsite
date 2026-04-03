import fs from "node:fs/promises";
import path from "node:path";

import {
  bitrixPayloadSchema,
  humanizeBitrixStage,
  humanizeMarketplace,
  mapBitrixStageToOrderStatus,
  type OrderRecord,
  type OrderStatus,
} from "shared";

import { config } from "../config.js";

interface BitrixApiResponse<T> {
  result?: T;
  error?: string;
  error_description?: string;
}

interface BitrixDuplicateResult {
  CONTACT?: Array<string | number>;
}

interface BitrixDeal {
  ID?: string | number;
  STAGE_ID?: string;
  CONTACT_ID?: string | number | null;
}

type BitrixDealFieldKey =
  | "orderNumber"
  | "orderType"
  | "marketplace"
  | "status"
  | "pickupAddress"
  | "customerName"
  | "customerPhone"
  | "itemCount"
  | "totalAmount"
  | "sourceUrl"
  | "deliveryAddress"
  | "relatedOrderNumbers"
  | "deliveryDate"
  | "deliveryTimeSlot"
  | "trackingNumber"
  | "shipmentNumber"
  | "senderName"
  | "pickupCode"
  | "size"
  | "productTitle"
  | "productAttachmentUrl"
  | "attachmentUrl";

type BitrixDealFieldMap = Partial<Record<BitrixDealFieldKey, string>>;

interface BitrixDealFieldEntry {
  key: BitrixDealFieldKey;
  label: string;
  value: number | string | null;
}

const bitrixDealFieldEnvMap = {
  orderNumber: "BITRIX_DEAL_FIELD_ORDER_NUMBER",
  orderType: "BITRIX_DEAL_FIELD_ORDER_TYPE",
  marketplace: "BITRIX_DEAL_FIELD_MARKETPLACE",
  status: "BITRIX_DEAL_FIELD_STATUS",
  pickupAddress: "BITRIX_DEAL_FIELD_PICKUP_ADDRESS",
  customerName: "BITRIX_DEAL_FIELD_CUSTOMER_NAME",
  customerPhone: "BITRIX_DEAL_FIELD_CUSTOMER_PHONE",
  itemCount: "BITRIX_DEAL_FIELD_ITEM_COUNT",
  totalAmount: "BITRIX_DEAL_FIELD_TOTAL_AMOUNT",
  sourceUrl: "BITRIX_DEAL_FIELD_SOURCE_URL",
  deliveryAddress: "BITRIX_DEAL_FIELD_DELIVERY_ADDRESS",
  relatedOrderNumbers: "BITRIX_DEAL_FIELD_RELATED_ORDER_NUMBERS",
  deliveryDate: "BITRIX_DEAL_FIELD_DELIVERY_DATE",
  deliveryTimeSlot: "BITRIX_DEAL_FIELD_DELIVERY_TIME_SLOT",
  trackingNumber: "BITRIX_DEAL_FIELD_TRACKING_NUMBER",
  shipmentNumber: "BITRIX_DEAL_FIELD_SHIPMENT_NUMBER",
  senderName: "BITRIX_DEAL_FIELD_SENDER_NAME",
  pickupCode: "BITRIX_DEAL_FIELD_PICKUP_CODE",
  size: "BITRIX_DEAL_FIELD_SIZE",
  productTitle: "BITRIX_DEAL_FIELD_PRODUCT_TITLE",
  productAttachmentUrl: "BITRIX_DEAL_FIELD_PRODUCT_ATTACHMENT_URL",
  attachmentUrl: "BITRIX_DEAL_FIELD_ATTACHMENT_URL",
} satisfies Record<BitrixDealFieldKey, string>;

const defaultBitrixDealFieldMap: BitrixDealFieldMap = {
  orderNumber: "UF_CRM_1774909222920",
  orderType: "UF_CRM_1774909231523",
  marketplace: "UF_CRM_1774909238633",
  status: "UF_CRM_1774909246381",
  pickupAddress: "UF_CRM_1774909256492",
  itemCount: "UF_CRM_1774908835361",
  totalAmount: "UF_CRM_1774908871627",
};

export interface BitrixSyncSnapshot {
  crmSyncState: OrderRecord["crmSyncState"];
  crmContactId: string | null;
  crmDealId: string | null;
  crmStageId: string | null;
  crmStageName: string | null;
  status: OrderStatus;
}

export class BitrixSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BitrixSyncError";
  }
}

function normalizeWebhookBaseUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function extractWebhookBaseUrl(raw: string) {
  const candidate = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));

  return normalizeWebhookBaseUrl(candidate ?? "");
}

function normalizeScalarId(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function buildBitrixWebhookFileCandidates() {
  return [
    path.resolve(process.cwd(), "bitrixwh.txt"),
    path.resolve(process.cwd(), ".codex", "bitrix-webhook.txt"),
    path.resolve(process.cwd(), "..", "bitrixwh.txt"),
    path.resolve(process.cwd(), "..", ".codex", "bitrix-webhook.txt"),
  ];
}

async function readWebhookFromFile() {
  for (const candidate of buildBitrixWebhookFileCandidates()) {
    try {
      const value = await fs.readFile(candidate, "utf8");
      const normalized = extractWebhookBaseUrl(value);
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return "";
}

function appendFormValue(params: URLSearchParams, key: string, value: unknown): void {
  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendFormValue(params, `${key}[${index}]`, entry));
    return;
  }

  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendFormValue(params, `${key}[${nestedKey}]`, nestedValue);
    }
    return;
  }

  params.append(key, String(value));
}

function buildBody(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    appendFormValue(params, key, value);
  }

  return params;
}

function buildPhoneVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set<string>();

  if (phone.trim()) {
    variants.add(phone.trim());
  }

  if (digits.length > 0) {
    variants.add(digits);
  }

  if (digits.length === 11) {
    if (digits.startsWith("7")) {
      variants.add(`+${digits}`);
      variants.add(`8${digits.slice(1)}`);
    }
    if (digits.startsWith("8")) {
      variants.add(`+7${digits.slice(1)}`);
      variants.add(`7${digits.slice(1)}`);
    }
  }

  return [...variants];
}

function buildContactFields(order: OrderRecord) {
  const firstName = order.customer.firstName.trim() || "Клиент";
  const lastName = order.customer.lastName?.trim() || "Не указан";

  return {
    NAME: firstName,
    LAST_NAME: lastName,
    SECOND_NAME: "Не указано",
    PHONE: [
      {
        VALUE: order.customer.phone,
        VALUE_TYPE: "WORK",
      },
    ],
  };
}

function buildOrderTypeLabel(orderType: OrderRecord["orderType"]) {
  switch (orderType) {
    case "pickup_standard":
      return "Самовывоз";
    case "pickup_paid":
      return "Оплаченный заказ";
    case "home_delivery":
      return "Доставка на дом";
  }
}

function buildCustomerFullName(order: OrderRecord) {
  const parts = [order.customer.firstName, order.customer.lastName].filter((value) => value && value.trim().length > 0);
  return parts.length > 0 ? parts.join(" ") : "Клиент";
}

function getConfiguredDealFieldMap(): BitrixDealFieldMap {
  const fieldMap: BitrixDealFieldMap = { ...defaultBitrixDealFieldMap };

  for (const [key, envName] of Object.entries(bitrixDealFieldEnvMap) as Array<[BitrixDealFieldKey, string]>) {
    const fieldCode = process.env[envName]?.trim();
    if (fieldCode) {
      fieldMap[key] = fieldCode;
    }
  }

  return fieldMap;
}

function buildDealFieldEntries(order: OrderRecord, attachmentUrl: string | null, productAttachmentUrl: string | null): BitrixDealFieldEntry[] {
  return [
    { key: "orderNumber", label: "Номер заказа", value: order.orderNumber },
    { key: "orderType", label: "Тип заказа", value: buildOrderTypeLabel(order.orderType) },
    { key: "marketplace", label: "Маркетплейс", value: humanizeMarketplace(order.marketplace) },
    { key: "status", label: "Статус", value: order.status },
    { key: "pickupAddress", label: "Адрес ПВЗ", value: order.pickupAddress },
    { key: "customerName", label: "ФИО", value: buildCustomerFullName(order) },
    { key: "customerPhone", label: "Телефон", value: order.customer.phone },
    { key: "totalAmount", label: "Сумма", value: order.totalAmount },
    { key: "itemCount", label: "Количество", value: order.itemCount },
    {
      key: "sourceUrl",
      label: "Ссылка на товар",
      value: order.sourceUrl ?? order.productPreview?.sourceUrl ?? null,
    },
    {
      key: "deliveryAddress",
      label: "Адрес доставки/ПВЗ",
      value: order.deliveryAddress ?? order.pickupAddress,
    },
    {
      key: "relatedOrderNumbers",
      label: "Номера заказов для доставки",
      value: order.relatedOrderNumbers.length > 0 ? order.relatedOrderNumbers.join(", ") : null,
    },
    { key: "deliveryDate", label: "Желаемая дата доставки", value: order.deliveryDate },
    { key: "deliveryTimeSlot", label: "Интервал доставки", value: order.deliveryTimeSlot },
    { key: "trackingNumber", label: "Трек-номер", value: order.trackingNumber },
    { key: "shipmentNumber", label: "Номер отправления ИМ", value: order.shipmentNumber },
    { key: "senderName", label: "Отправитель / интернет-магазин", value: order.senderName },
    { key: "pickupCode", label: "Код получения", value: order.pickupCode },
    { key: "size", label: "\u0420\u0430\u0437\u043c\u0435\u0440", value: order.size },
    { key: "productTitle", label: "Товар", value: order.productPreview?.title ?? null },
    {
      key: "productAttachmentUrl",
      label: "Скриншот товара",
      value: productAttachmentUrl ?? order.productAttachment?.filePath ?? null,
    },
    {
      key: "attachmentUrl",
      label: "Штрих-код / QR",
      value: attachmentUrl ?? order.attachment?.filePath ?? null,
    },
  ];
}

function buildMappedDealFields(entries: BitrixDealFieldEntry[], fieldMap: BitrixDealFieldMap) {
  const fields: Record<string, string | number> = {};

  for (const entry of entries) {
    const fieldCode = fieldMap[entry.key];
    if (!fieldCode || entry.value == null) {
      continue;
    }

    fields[fieldCode] = entry.value;
  }

  return fields;
}

function buildDealComments(entries: BitrixDealFieldEntry[], fieldMap: BitrixDealFieldMap) {
  return entries
    .filter((entry) => entry.value != null && !fieldMap[entry.key])
    .map((entry) => `${entry.label}: ${entry.value}`)
    .join("\n");
}

function createSnapshot(input: {
  crmSyncState: OrderRecord["crmSyncState"];
  crmContactId?: string | null;
  crmDealId?: string | null;
  crmStageId?: string | null;
  status?: OrderStatus | null;
}) {
  const crmStageId = input.crmStageId ?? null;

  return {
    crmSyncState: input.crmSyncState,
    crmContactId: input.crmContactId ?? null,
    crmDealId: input.crmDealId ?? null,
    crmStageId,
    crmStageName: humanizeBitrixStage(crmStageId),
    status: input.status ?? mapBitrixStageToOrderStatus(crmStageId) ?? "PROCESSING",
  } satisfies BitrixSyncSnapshot;
}

export class BitrixService {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly configuredWebhookBaseUrl = normalizeWebhookBaseUrl(config.bitrixWebhookUrl),
    private readonly dealFieldMap: BitrixDealFieldMap = getConfiguredDealFieldMap(),
  ) {}

  private async getWebhookBaseUrl() {
    if (this.configuredWebhookBaseUrl) {
      return this.configuredWebhookBaseUrl;
    }

    return readWebhookFromFile();
  }

  async isConfigured() {
    const webhook = await this.getWebhookBaseUrl();
    return webhook.length > 0;
  }

  private async callMethod<T>(method: string, payload: Record<string, unknown>) {
    const webhookBaseUrl = await this.getWebhookBaseUrl();

    if (!webhookBaseUrl) {
      throw new BitrixSyncError("Не настроен webhook Bitrix24.");
    }

    const response = await this.fetchImpl(`${webhookBaseUrl}${method}.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildBody(payload),
    });

    const data = (await response.json().catch(() => null)) as BitrixApiResponse<T> | null;

    if (!response.ok) {
      throw new BitrixSyncError(`Bitrix24 вернул HTTP ${response.status} для метода ${method}.`);
    }

    if (!data) {
      throw new BitrixSyncError(`Bitrix24 вернул пустой ответ для метода ${method}.`);
    }

    if (data.error) {
      throw new BitrixSyncError(data.error_description ?? data.error);
    }

    if (data.result === undefined) {
      throw new BitrixSyncError(`Bitrix24 не вернул result для метода ${method}.`);
    }

    return data.result;
  }

  async syncOrder(order: OrderRecord, attachmentUrl: string | null, productAttachmentUrl: string | null = null): Promise<BitrixSyncSnapshot> {
    const crmContactId = await this.findOrCreateContact(order);
    const crmDealId = await this.createDeal(order, crmContactId, attachmentUrl, productAttachmentUrl);

    return createSnapshot({
      crmSyncState: "synced",
      crmContactId,
      crmDealId,
      crmStageId: "NEW",
      status: "CREATED",
    });
  }

  async refreshOrder(order: OrderRecord): Promise<BitrixSyncSnapshot> {
    if (!order.crmDealId) {
      return createSnapshot({
        crmSyncState: order.crmSyncState,
        crmContactId: order.crmContactId,
        crmDealId: order.crmDealId,
        crmStageId: order.crmStageId,
        status: order.status,
      });
    }

    const deal = await this.callMethod<BitrixDeal>("crm.deal.get", {
      id: order.crmDealId,
    });
    const crmStageId = normalizeScalarId(deal.STAGE_ID) ?? order.crmStageId;

    return createSnapshot({
      crmSyncState: "synced",
      crmContactId: normalizeScalarId(deal.CONTACT_ID) ?? order.crmContactId,
      crmDealId: normalizeScalarId(deal.ID) ?? order.crmDealId,
      crmStageId,
      status: mapBitrixStageToOrderStatus(crmStageId) ?? order.status,
    });
  }

  private async findOrCreateContact(order: OrderRecord) {
    const duplicateResult = await this.callMethod<BitrixDuplicateResult>("crm.duplicate.findbycomm", {
      entity_type: "CONTACT",
      type: "PHONE",
      values: buildPhoneVariants(order.customer.phone),
    });

    const existingId = duplicateResult.CONTACT?.map((value) => normalizeScalarId(value)).find(Boolean) ?? null;

    if (existingId) {
      return existingId;
    }

    const createdId = await this.callMethod<string | number>("crm.contact.add", {
      fields: buildContactFields(order),
    });

    const normalizedId = normalizeScalarId(createdId);

    if (!normalizedId) {
      throw new BitrixSyncError("Bitrix24 не вернул ID контакта.");
    }

    return normalizedId;
  }

  private async createDeal(order: OrderRecord, crmContactId: string | null, attachmentUrl: string | null, productAttachmentUrl: string | null) {
    const dealEntries = buildDealFieldEntries(order, attachmentUrl, productAttachmentUrl);
    const mappedDealFields = buildMappedDealFields(dealEntries, this.dealFieldMap);
    const comments = buildDealComments(dealEntries, this.dealFieldMap);

    const dealId = await this.callMethod<string | number>("crm.deal.add", {
      fields: {
        TITLE: `SUPERBOX #${order.orderNumber}`,
        CATEGORY_ID: 0,
        STAGE_ID: "NEW",
        SOURCE_ID: "WEB",
        ORIGINATOR_ID: "SUPERBOX",
        ORIGIN_ID: order.orderNumber,
        CONTACT_ID: crmContactId,
        OPPORTUNITY: order.totalAmount ?? undefined,
        ...mappedDealFields,
        COMMENTS: comments || undefined,
      },
    });

    const normalizedId = normalizeScalarId(dealId);

    if (!normalizedId) {
      throw new BitrixSyncError("Bitrix24 не вернул ID сделки.");
    }

    return normalizedId;
  }
}

export function mapOrderToBitrixPayload(order: OrderRecord) {
  const payload = {
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    marketplace: order.marketplace,
    status: order.status,
    pickupAddress: order.pickupAddress,
    customer: {
      fullName: buildCustomerFullName(order),
      phone: order.customer.phone,
    },
    logistics: {
      sourceUrl: order.sourceUrl,
      deliveryAddress: order.deliveryAddress,
      relatedOrderNumbers: order.relatedOrderNumbers,
      deliveryDate: order.deliveryDate,
      deliveryTimeSlot: order.deliveryTimeSlot,
      trackingNumber: order.trackingNumber,
      shipmentNumber: order.shipmentNumber,
      senderName: order.senderName,
      pickupCode: order.pickupCode,
      size: order.size,
    },
    pricing: {
      itemCount: order.itemCount,
      totalAmount: order.totalAmount,
      deliveryFee: order.orderType === "home_delivery" ? 300 : null,
    },
    productPreview: order.productPreview,
  };

  return bitrixPayloadSchema.parse(payload);
}
