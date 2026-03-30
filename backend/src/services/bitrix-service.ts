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

function buildDealComments(order: OrderRecord, attachmentUrl: string | null, productAttachmentUrl: string | null) {
  const lines = [
    `Номер заказа: ${order.orderNumber}`,
    `Тип заказа: ${buildOrderTypeLabel(order.orderType)}`,
    `Маркетплейс: ${humanizeMarketplace(order.marketplace)}`,
    `ФИО: ${buildCustomerFullName(order)}`,
    `Телефон: ${order.customer.phone}`,
    `Сумма: ${order.totalAmount != null ? `${order.totalAmount} RUB` : "не указана"}`,
    `Количество: ${order.itemCount != null ? String(order.itemCount) : "не указано"}`,
    `Ссылка на товар: ${order.sourceUrl ?? order.productPreview?.sourceUrl ?? "не указана"}`,
    `Адрес доставки/ПВЗ: ${order.deliveryAddress ?? order.pickupAddress}`,
  ];

  if (order.relatedOrderNumbers.length > 0) {
    lines.push(`Номера заказов для доставки: ${order.relatedOrderNumbers.join(", ")}`);
  }

  if (order.deliveryDate) {
    lines.push(`Желаемая дата доставки: ${order.deliveryDate}`);
  }

  if (order.deliveryTimeSlot) {
    lines.push(`Интервал доставки: ${order.deliveryTimeSlot}`);
  }

  if (order.trackingNumber) {
    lines.push(`Трек-номер: ${order.trackingNumber}`);
  }

  if (order.shipmentNumber) {
    lines.push(`Номер отправления ИМ: ${order.shipmentNumber}`);
  }

  if (order.senderName) {
    lines.push(`Отправитель / интернет-магазин: ${order.senderName}`);
  }

  if (order.pickupCode) {
    lines.push(`Код получения: ${order.pickupCode}`);
  }

  if (order.productPreview?.title) {
    lines.push(`Товар: ${order.productPreview.title}`);
  }

  if (productAttachmentUrl) {
    lines.push(`Скриншот товара: ${productAttachmentUrl}`);
  } else if (order.productAttachment) {
    lines.push(`Скриншот товара: ${order.productAttachment.fileName} (${order.productAttachment.filePath})`);
  }

  if (attachmentUrl) {
    lines.push(`Штрих-код / QR: ${attachmentUrl}`);
  } else if (order.attachment) {
    lines.push(`Штрих-код / QR: ${order.attachment.fileName} (${order.attachment.filePath})`);
  }

  return lines.join("\n");
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
        COMMENTS: buildDealComments(order, attachmentUrl, productAttachmentUrl),
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
