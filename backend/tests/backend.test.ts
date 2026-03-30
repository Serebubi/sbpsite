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

  it("does not return an invalid-number error when item count is omitted", async () => {
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_standard")
      .field("marketplace", "wildberries")
      .field("firstName", "Сергей")
      .field("lastName", "Иванов")
      .field("phone", "+79997776655")
      .field("totalAmount", "4300")
      .field("sourceUrl", "https://www.wildberries.ru/catalog/123/detail.aspx");

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.message).toContain("Проверьте заполнение формы");
    expect(createResponse.body.message).not.toContain("заполнено некорректно");
  });

  it("creates a home delivery request from existing order numbers", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(333);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(701);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const baseOrderResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_standard")
      .field("marketplace", "wildberries")
      .field("firstName", "Сергей")
      .field("lastName", "Иванов")
      .field("phone", "+79997776655")
      .field("itemCount", "2")
      .field("totalAmount", "4300")
      .field("sourceUrl", "https://www.wildberries.ru/catalog/123/detail.aspx");

    expect(baseOrderResponse.status).toBe(201);

    const deliveryResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "home_delivery")
      .field("orderNumbers", JSON.stringify([baseOrderResponse.body.order.orderNumber]))
      .field("deliveryAddress", "Мариуполь, Ленина 1")
      .field("deliveryDate", "2026-03-28")
      .field("deliveryTimeSlot", "12:00-15:00");

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryResponse.body.order.marketplace).toBe("home_delivery");
    expect(deliveryResponse.body.order.relatedOrderNumbers).toEqual([baseOrderResponse.body.order.orderNumber]);
    expect(deliveryResponse.body.order.deliveryTimeSlot).toBe("12:00-15:00");
  });


  it("creates a paid cdek order without attachment", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(333);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(777);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "cdek")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("trackingNumber", "12345678901")
      .field("pickupCode", "7788");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("cdek");
    expect(createResponse.body.order.trackingNumber).toBe("12345678901");
    expect(createResponse.body.order.pickupCode).toBe("7788");
    expect(createResponse.body.order.attachment).toBeNull();
  });

  it("creates a cdek paid order with shipment number only", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(334);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(779);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "cdek")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("shipmentNumber", "CN0016355297RU9");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("cdek");
    expect(createResponse.body.order.trackingNumber).toBeNull();
    expect(createResponse.body.order.shipmentNumber).toBe("CN0016355297RU9");
    expect(createResponse.body.order.pickupCode).toBeNull();
  });

  it("creates a paid 5post order without attachment", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(333);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(778);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "5post")
      .field("firstName", "Ivan Ivanovich")
      .field("phone", "+79997776655")
      .field("trackingNumber", "5POST-123456")
      .field("pickupCode", "4455");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("5post");
    expect(createResponse.body.order.trackingNumber).toBe("5POST-123456");
    expect(createResponse.body.order.pickupCode).toBe("4455");
    expect(createResponse.body.order.attachment).toBeNull();
  });

  it("creates a paid dpd order without attachment", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(333);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(779);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "dpd")
      .field("firstName", "Ivan Ivanovich")
      .field("phone", "+79997776655")
      .field("trackingNumber", "DPD-123456")
      .field("pickupCode", "5566");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("dpd");
    expect(createResponse.body.order.trackingNumber).toBe("DPD-123456");
    expect(createResponse.body.order.pickupCode).toBe("5566");
    expect(createResponse.body.order.attachment).toBeNull();
  });

  it("creates a paid avito order without attachment", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(333);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(780);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "avito")
      .field("firstName", "Ivan Ivanovich")
      .field("phone", "+79997776655")
      .field("trackingNumber", "AVITO-123456")
      .field("pickupCode", "6677");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("avito");
    expect(createResponse.body.order.trackingNumber).toBe("AVITO-123456");
    expect(createResponse.body.order.pickupCode).toBe("6677");
    expect(createResponse.body.order.attachment).toBeNull();
  });

  it("creates a paid detmir order with order number and optional pickup code", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(335);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(781);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "detmir")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("trackingNumber", "DM-123456")
      .field("pickupCode", "8899")
      .field("itemCount", "2")
      .field("totalAmount", "3500")
      .attach("attachment", Buffer.from("test file"), "detmir-order.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("detmir");
    expect(createResponse.body.order.trackingNumber).toBe("DM-123456");
    expect(createResponse.body.order.pickupCode).toBe("8899");
    expect(createResponse.body.order.itemCount).toBe(2);
    expect(createResponse.body.order.totalAmount).toBe(3500);
  });

  it("creates a paid goldapple order with required order number", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(336);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(782);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "goldapple")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("trackingNumber", "GA-123456")
      .field("itemCount", "2")
      .field("totalAmount", "3500")
      .attach("attachment", Buffer.from("test file"), "goldapple-order.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("goldapple");
    expect(createResponse.body.order.trackingNumber).toBe("GA-123456");
    expect(createResponse.body.order.itemCount).toBe(2);
    expect(createResponse.body.order.totalAmount).toBe(3500);
  });

  it("creates a paid letual order with required order number", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(338);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(784);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "letual")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("trackingNumber", "LET-123456")
      .field("itemCount", "2")
      .field("totalAmount", "3500")
      .attach("attachment", Buffer.from("test file"), "letual-order.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("letual");
    expect(createResponse.body.order.trackingNumber).toBe("LET-123456");
    expect(createResponse.body.order.itemCount).toBe(2);
    expect(createResponse.body.order.totalAmount).toBe(3500);
  });

  it("creates a wildberries premium paid order with two attachments", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(340);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(786);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "wildberries_premium")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("totalAmount", "25000")
      .attach("productAttachment", Buffer.from("product file"), "wb-premium-product.png")
      .attach("attachment", Buffer.from("barcode file"), "wb-premium-qr.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("wildberries_premium");
    expect(createResponse.body.order.totalAmount).toBe(25000);
    expect(createResponse.body.order.productAttachment.fileName).toBe("wb-premium-product.png");
    expect(createResponse.body.order.attachment.fileName).toBe("wb-premium-qr.png");
  });

  it("creates a bulky paid order with sender name and optional codes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(337);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(783);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "bulky")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("senderName", "OZON")
      .field("trackingNumber", "BULKY-42")
      .field("pickupCode", "7788")
      .attach("attachment", Buffer.from("test file"), "bulky-order.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("bulky");
    expect(createResponse.body.order.senderName).toBe("OZON");
    expect(createResponse.body.order.trackingNumber).toBe("BULKY-42");
    expect(createResponse.body.order.pickupCode).toBe("7788");
  });

  it("creates a courier paid order with sender name and totals", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("crm.duplicate.findbycomm")) {
        return createBitrixResponse({});
      }

      if (url.includes("crm.contact.add")) {
        return createBitrixResponse(339);
      }

      if (url.includes("crm.deal.add")) {
        return createBitrixResponse(785);
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    const app = createApp();

    const createResponse = await request(app)
      .post("/orders/create")
      .field("orderType", "pickup_paid")
      .field("marketplace", "courier")
      .field("firstName", "Ivan")
      .field("lastName", "Ivanov")
      .field("phone", "+79997776655")
      .field("senderName", "Ривгош")
      .field("trackingNumber", "COURIER-42")
      .field("pickupCode", "4455")
      .field("itemCount", "2")
      .field("totalAmount", "3500")
      .attach("attachment", Buffer.from("test file"), "courier-order.png");

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.order.marketplace).toBe("courier");
    expect(createResponse.body.order.senderName).toBe("Ривгош");
    expect(createResponse.body.order.trackingNumber).toBe("COURIER-42");
    expect(createResponse.body.order.pickupCode).toBe("4455");
    expect(createResponse.body.order.itemCount).toBe(2);
    expect(createResponse.body.order.totalAmount).toBe(3500);
  });

  it("maps an order to bitrix payload", () => {
    const payload = mapOrderToBitrixPayload({
      id: "5fb3108c-8ed0-4eaf-9271-fcd0f463b812",
      orderNumber: "123456",
      orderType: "home_delivery",
      marketplace: "home_delivery",
      status: "CREATED",
      pickupAddress: "Грушевского, 8",
      customer: {
        firstName: "Ирина",
        lastName: null,
        phone: "+79997776655",
      },
      relatedOrderNumbers: ["669281", "669282"],
      itemCount: null,
      totalAmount: null,
      trackingNumber: null,
      senderName: null,
      shipmentNumber: null,
      pickupCode: null,
      sourceUrl: null,
      deliveryAddress: "Мариуполь, Ленина 1",
      deliveryDate: "2026-03-28",
      deliveryTimeSlot: "12:00-15:00",
      productPreview: null,
      attachment: null,
      productAttachment: null,
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
