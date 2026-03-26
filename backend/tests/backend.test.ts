import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { mapOrderToBitrixPayload } from "../src/services/bitrix-service.js";
import { previewMarketplaceLink } from "../src/services/parser-service.js";

function createBitrixResponse(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ result }),
  } satisfies Partial<Response> as Response;
}

describe("backend api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fallback preview for unsupported domain", async () => {
    const result = await previewMarketplaceLink("wildberries", "https://example.com/item/test-item");
    expect(result.mode).toBe("fallback");
  });

  it("creates an order, syncs it to Bitrix, and refreshes status from the deal stage", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(321);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(654);
      }

      if (url.includes("crm.deal.get")) {
        return createBitrixResponse({
          ID: 654,
          CONTACT_ID: 321,
          STAGE_ID: "UC_FBIO6R",
        });
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_standard")
      .field("marketplace", "wildberries")
      .field("firstName", "Сергей")
      .field("lastName", "Иванов")
      .field("phone", "+79997776655")
      .field("itemCount", "2")
      .field("totalAmount", "4300")
      .field("sourceUrl", "https://www.wildberries.ru/catalog/123/detail.aspx");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.crmSyncState).toBe("synced");
    expect(createResponse.body.order.crmContactId).toBe("321");
    expect(createResponse.body.order.crmDealId).toBe("654");
    expect(createResponse.body.order.crmStageId).toBe("NEW");
    expect(createResponse.body.order.crmStageName).toBe("Новые заказы");

    const orderNumber = createResponse.body.order.orderNumber as string;

    const fetchResponse = await request(app).get(`/orders/${orderNumber}`);
    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.order.marketplace).toBe("wildberries");
    expect(fetchResponse.body.order.status).toBe("READY_FOR_PICKUP");
    expect(fetchResponse.body.order.crmStageId).toBe("UC_FBIO6R");
    expect(fetchResponse.body.order.crmStageName).toBe("заказ готов к выдаче");
  });

  it("keeps the local order when Bitrix is unavailable during creation", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error("Bitrix unavailable");
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_standard")
      .field("marketplace", "wildberries")
      .field("firstName", "Анна")
      .field("lastName", "Петрова")
      .field("phone", "+79990001122")
      .field("itemCount", "1")
      .field("totalAmount", "1500")
      .field("sourceUrl", "https://www.wildberries.ru/catalog/456/detail.aspx");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.crmSyncState).toBe("failed");
    expect(createResponse.body.order.crmDealId).toBeNull();
    expect(createResponse.body.order.status).toBe("CREATED");
  });

  it("maps an order to bitrix payload", () => {
    const payload = mapOrderToBitrixPayload({
      id: "5fb3108c-8ed0-4eaf-9271-fcd0f463b812",
      orderNumber: "123456",
      orderType: "home_delivery",
      marketplace: "ozon",
      status: "CREATED",
      pickupAddress: "Грушевского, 8",
      customer: {
        firstName: "Ирина",
        lastName: null,
        phone: "+79997776655",
      },
      itemCount: null,
      totalAmount: null,
      sourceUrl: "https://www.ozon.ru/product/test",
      deliveryAddress: "Мариуполь, Ленина 1",
      productPreview: {
        title: "Товар",
        price: 2300,
        imageUrl: null,
        sourceUrl: "https://www.ozon.ru/product/test",
        parserMode: "parsed",
        parserMessage: "Карточка успешно распознана.",
      },
      attachment: null,
      crmSyncState: "pending",
      crmContactId: null,
      crmDealId: null,
      crmStageId: null,
      crmStageName: null,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(payload.pricing.deliveryFee).toBe(300);
    expect(payload.customer.fullName).toBe("Ирина");
  });
});
