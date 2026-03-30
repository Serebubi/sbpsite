import type { Request, Response } from "express";
import { Router } from "express";

import {
  cancelOrderSchema,
  createOrderResponseSchema,
  createOrderSchema,
  homeDeliveryMarketplaceId,
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

function getUploadedFile(files: Request["files"], fieldName: string) {
  if (!files || Array.isArray(files)) {
    return null;
  }

  return files[fieldName]?.[0] ?? null;
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

  router.post("/create", upload.fields([{ name: "attachment", maxCount: 1 }, { name: "productAttachment", maxCount: 1 }]), async (request: Request, response: Response, next) => {
    try {
      const body = request.body as Record<string, string | undefined>;
      const attachmentFile = getUploadedFile(request.files, "attachment");
      const productAttachmentFile = getUploadedFile(request.files, "productAttachment");
      const rawPayload =
        body.orderType === "home_delivery"
          ? {
              orderType: body.orderType,
              marketplace: homeDeliveryMarketplaceId,
              orderNumbers: body.orderNumbers ? JSON.parse(body.orderNumbers) : [],
              deliveryAddress: body.deliveryAddress,
              deliveryDate: body.deliveryDate,
              deliveryTimeSlot: body.deliveryTimeSlot,
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
            : body.marketplace === "cdek" || body.marketplace === "5post" || body.marketplace === "dpd" || body.marketplace === "avito"
              ? {
                  orderType: body.orderType,
                  marketplace: body.marketplace,
                  firstName: body.firstName,
                  lastName: body.lastName,
                  phone: body.phone,
                  trackingNumber: body.trackingNumber,
                  shipmentNumber: body.shipmentNumber,
                  pickupCode: body.pickupCode,
                }
              : body.marketplace === "wildberries_premium"
                ? {
                    orderType: body.orderType,
                    marketplace: body.marketplace,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    phone: body.phone,
                    totalAmount: parseNumberField(body.totalAmount, "Общая сумма"),
                  }
              : body.marketplace === "bulky"
                ? {
                    orderType: body.orderType,
                    marketplace: body.marketplace,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    phone: body.phone,
                    senderName: body.senderName,
                    trackingNumber: body.trackingNumber,
                    pickupCode: body.pickupCode,
                  }
              : body.marketplace === "courier"
                ? {
                    orderType: body.orderType,
                    marketplace: body.marketplace,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    phone: body.phone,
                    senderName: body.senderName,
                    trackingNumber: body.trackingNumber,
                    pickupCode: body.pickupCode,
                    itemCount: parseNumberField(body.itemCount, "Количество товаров"),
                    totalAmount: parseNumberField(body.totalAmount, "Общая сумма"),
                  }
              : {
                  orderType: body.orderType,
                  marketplace: body.marketplace,
                  firstName: body.firstName,
                  lastName: body.lastName,
                  phone: body.phone,
                  itemCount: parseNumberField(body.itemCount, "Количество товаров"),
                  totalAmount: parseNumberField(body.totalAmount, "Общая сумма"),
                  trackingNumber: body.trackingNumber,
                  pickupCode: body.pickupCode,
                };
      const payload = createOrderSchema.parse(rawPayload);

      if (payload.orderType === "pickup_paid" && payload.marketplace === "wildberries_premium") {
        if (!productAttachmentFile) {
          throw new HttpError(400, "Прикрепите скриншот товара.");
        }
        if (!attachmentFile) {
          throw new HttpError(400, "Приложите штрих-код или QR код для получения.");
        }
      }

      if (
        payload.orderType === "pickup_paid" &&
        payload.marketplace !== "wildberries_premium" &&
        payload.marketplace !== "cdek" &&
        payload.marketplace !== "5post" &&
        payload.marketplace !== "dpd" &&
        payload.marketplace !== "avito" &&
        !attachmentFile
      ) {
        throw new HttpError(400, "Прикрепите QR или штрих-код.");
      }

      if ("sourceUrl" in payload && !isAllowedDomainForMarketplace(payload.sourceUrl, payload.marketplace)) {
        throw new HttpError(400, "Ссылка не соответствует выбранному маркетплейсу.");
      }

      const attachment = toAttachmentRecord(attachmentFile);
      const productAttachment = toAttachmentRecord(productAttachmentFile);
      const order = await orderService.createOrder(
        payload,
        attachment,
        getAttachmentUrl(request, attachment?.filePath ?? null),
        productAttachment,
        getAttachmentUrl(request, productAttachment?.filePath ?? null),
      );
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
