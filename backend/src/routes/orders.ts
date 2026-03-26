import type { Request, Response } from "express";
import { Router } from "express";

import {
  cancelOrderSchema,
  createOrderResponseSchema,
  createOrderSchema,
  isAllowedDomainForMarketplace,
  previewLinkResponseSchema,
  previewLinkSchema,
} from "shared";

import { HttpError } from "../lib/http-error.js";
import { previewMarketplaceLink } from "../services/parser-service.js";
import { OrderService } from "../services/order-service.js";
import { getAttachmentUrl, toAttachmentRecord, upload } from "../storage/attachment-store.js";

function parseNumberField(rawValue: unknown, fieldLabel: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `Поле "${fieldLabel}" заполнено некорректно.`);
  }

  return parsed;
}

export function createOrderRouter(orderService: OrderService) {
  const router = Router();

  router.post("/preview-link", async (request, response, next) => {
    try {
      const input = previewLinkSchema.parse(request.body);
      const result = await previewMarketplaceLink(input.marketplace, input.url);
      response.json(previewLinkResponseSchema.parse(result));
    } catch (error) {
      next(error);
    }
  });

  router.post("/create", upload.single("attachment"), async (request: Request, response: Response, next) => {
    try {
      const body = request.body as Record<string, string | undefined>;
      const rawPayload =
        body.orderType === "home_delivery"
          ? {
              orderType: body.orderType,
              marketplace: body.marketplace,
              firstName: body.firstName,
              phone: body.phone,
              deliveryAddress: body.deliveryAddress,
              sourceUrl: body.sourceUrl,
              productPreview: body.productPreview ? JSON.parse(body.productPreview) : null,
            }
          : body.orderType === "pickup_standard"
            ? {
                orderType: body.orderType,
                marketplace: body.marketplace,
                firstName: body.firstName,
                lastName: body.lastName,
                phone: body.phone,
                itemCount: parseNumberField(body.itemCount, "Количество товаров"),
                totalAmount: parseNumberField(body.totalAmount, "Общая сумма"),
                sourceUrl: body.sourceUrl,
              }
          : {
              orderType: body.orderType,
              marketplace: body.marketplace,
              firstName: body.firstName,
              lastName: body.lastName,
              phone: body.phone,
              itemCount: parseNumberField(body.itemCount, "Количество товаров"),
              totalAmount: parseNumberField(body.totalAmount, "Общая сумма"),
            };
      const payload = createOrderSchema.parse(rawPayload);

      if (payload.orderType === "pickup_paid" && !request.file) {
        throw new HttpError(400, "Прикрепите QR или штрих-код.");
      }

      if ("sourceUrl" in payload && !isAllowedDomainForMarketplace(payload.sourceUrl, payload.marketplace)) {
        throw new HttpError(400, "Ссылка не соответствует выбранному маркетплейсу.");
      }

      const attachment = toAttachmentRecord(request.file);
      const order = await orderService.createOrder(payload, attachment, getAttachmentUrl(request, attachment?.filePath ?? null));
      response.status(201).json(
        createOrderResponseSchema.parse({
          order,
          message: "Заказ создан",
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/cancel", async (request, response, next) => {
    try {
      const input = cancelOrderSchema.parse(request.body);
      const order = await orderService.cancelOrder(input.orderNumber);
      response.json({
        order,
        message: "Заказ отменен",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const order = await orderService.getOrder(request.params.id);
      response.json({ order });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
