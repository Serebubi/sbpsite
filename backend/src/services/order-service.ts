import { v4 as uuid } from "uuid";

import {
  cancelOrderSchema,
  createOrderSchema,
  orderSchema,
  pickupAddress,
  type OrderRecord,
} from "shared";

import { HttpError } from "../lib/http-error.js";
import { FileOrderRepository } from "../storage/order-repository.js";
import { BitrixService, BitrixSyncError, type BitrixSyncSnapshot } from "./bitrix-service.js";

type CreateOrderPayload = ReturnType<typeof createOrderSchema.parse>;

function nowIso() {
  return new Date().toISOString();
}

function appendEvent(order: OrderRecord, event: OrderRecord["events"][number]) {
  return [...order.events, event];
}

export class OrderService {
  constructor(
    private repository: FileOrderRepository,
    private bitrixService = new BitrixService(),
  ) {}

  async createOrder(
    payload: CreateOrderPayload,
    attachment: OrderRecord["attachment"],
    attachmentUrl: string | null,
  ) {
    const orders = await this.repository.listOrders();
    const nextNumber = String(
      Math.max(
        669280,
        ...orders.map((order) => Number.parseInt(order.orderNumber, 10)).filter(Number.isFinite),
      ) + 1,
    );
    const createdAt = nowIso();
    const lastName = "lastName" in payload ? payload.lastName : undefined;
    const baseOrder: OrderRecord = orderSchema.parse({
      id: uuid(),
      orderNumber: nextNumber,
      orderType: payload.orderType,
      marketplace: payload.marketplace,
      status: "CREATED",
      pickupAddress,
      customer: {
        firstName: payload.firstName,
        lastName: lastName ?? null,
        phone: payload.phone,
      },
      itemCount: "itemCount" in payload ? payload.itemCount : null,
      totalAmount: "totalAmount" in payload ? payload.totalAmount : null,
      sourceUrl: "sourceUrl" in payload ? payload.sourceUrl : null,
      deliveryAddress: "deliveryAddress" in payload ? payload.deliveryAddress : null,
      productPreview: "productPreview" in payload ? payload.productPreview : null,
      attachment,
      crmSyncState: "pending",
      crmContactId: null,
      crmDealId: null,
      crmStageId: null,
      crmStageName: null,
      events: [
        {
          type: "created",
          at: createdAt,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    });

    const savedOrder = await this.repository.saveOrder(baseOrder);

    try {
      const snapshot = await this.bitrixService.syncOrder(savedOrder, attachmentUrl);
      const syncedOrder = this.applyBitrixSnapshot(savedOrder, snapshot, true);
      return this.repository.saveOrder(syncedOrder);
    } catch (error) {
      const failedOrder = this.applyBitrixFailure(savedOrder, error);
      return this.repository.saveOrder(failedOrder);
    }
  }

  async getOrder(orderNumber: string) {
    const validated = cancelOrderSchema.parse({ orderNumber });
    const order = await this.repository.findByOrderNumber(validated.orderNumber);
    if (!order) {
      throw new HttpError(404, "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ. РџСЂРѕРІРµСЂСЊС‚Рµ РїСЂР°РІРёР»СЊРЅРѕСЃС‚СЊ РІРІРµРґРµРЅРЅРѕРіРѕ РЅРѕРјРµСЂР°.");
    }

    if (!order.crmDealId) {
      return order;
    }

    try {
      const snapshot = await this.bitrixService.refreshOrder(order);
      const refreshedOrder = this.applyBitrixSnapshot(order, snapshot, false);

      if (this.hasBitrixChanges(order, refreshedOrder)) {
        return this.repository.saveOrder(refreshedOrder);
      }

      return refreshedOrder;
    } catch (error) {
      if (error instanceof BitrixSyncError) {
        return order;
      }

      throw error;
    }
  }

  async cancelOrder(orderNumber: string) {
    const validated = cancelOrderSchema.parse({ orderNumber });
    const existing = await this.repository.findByOrderNumber(validated.orderNumber);

    if (!existing) {
      throw new HttpError(404, "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ. РџСЂРѕРІРµСЂСЊС‚Рµ РїСЂР°РІРёР»СЊРЅРѕСЃС‚СЊ РІРІРµРґРµРЅРЅРѕРіРѕ РЅРѕРјРµСЂР°.");
    }

    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new HttpError(409, "Р­С‚РѕС‚ Р·Р°РєР°Р· СѓР¶Рµ Р·Р°РІРµСЂС€РµРЅ Рё РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕС‚РјРµРЅРµРЅ.");
    }

    const cancelledAt = nowIso();
    const updated = orderSchema.parse({
      ...existing,
      status: "CANCELLED",
      crmSyncState: "queued",
      updatedAt: cancelledAt,
      events: appendEvent(existing, {
        type: "cancelled",
        at: cancelledAt,
      }),
    });

    return this.repository.saveOrder(updated);
  }

  private applyBitrixSnapshot(order: OrderRecord, snapshot: BitrixSyncSnapshot, forceAuditEvent: boolean) {
    const syncedAt = nowIso();
    const nextEvents = [...order.events];
    const changed =
      order.status !== snapshot.status ||
      order.crmSyncState !== snapshot.crmSyncState ||
      order.crmContactId !== snapshot.crmContactId ||
      order.crmDealId !== snapshot.crmDealId ||
      order.crmStageId !== snapshot.crmStageId ||
      order.crmStageName !== snapshot.crmStageName;

    if (forceAuditEvent || changed) {
      nextEvents.push({
        type: "bitrix_synced",
        at: syncedAt,
        payload: {
          crmContactId: snapshot.crmContactId,
          crmDealId: snapshot.crmDealId,
          crmStageId: snapshot.crmStageId,
        },
      });
    }

    if (order.status !== snapshot.status) {
      nextEvents.push({
        type: "status_changed",
        at: syncedAt,
        payload: {
          from: order.status,
          to: snapshot.status,
          source: "bitrix",
        },
      });
    }

    return orderSchema.parse({
      ...order,
      status: snapshot.status,
      crmSyncState: snapshot.crmSyncState,
      crmContactId: snapshot.crmContactId,
      crmDealId: snapshot.crmDealId,
      crmStageId: snapshot.crmStageId,
      crmStageName: snapshot.crmStageName,
      updatedAt: forceAuditEvent || changed ? syncedAt : order.updatedAt,
      events: nextEvents,
    });
  }

  private applyBitrixFailure(order: OrderRecord, error: unknown) {
    const failedAt = nowIso();
    const message =
      error instanceof BitrixSyncError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Не удалось выполнить синхронизацию с Bitrix24.";

    return orderSchema.parse({
      ...order,
      crmSyncState: "failed",
      updatedAt: failedAt,
      events: appendEvent(order, {
        type: "bitrix_sync_failed",
        at: failedAt,
        payload: {
          message,
        },
      }),
    });
  }

  private hasBitrixChanges(current: OrderRecord, next: OrderRecord) {
    return (
      current.status !== next.status ||
      current.crmSyncState !== next.crmSyncState ||
      current.crmContactId !== next.crmContactId ||
      current.crmDealId !== next.crmDealId ||
      current.crmStageId !== next.crmStageId ||
      current.crmStageName !== next.crmStageName ||
      current.events.length !== next.events.length
    );
  }
}
