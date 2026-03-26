import type { OrderRecord, ProductPreview } from "shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(data.message ?? "Запрос не выполнен");
  }

  return data;
}

export async function previewLink(payload: { marketplace: string; url: string }) {
  const response = await fetch(`${API_BASE_URL}/orders/preview-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<{
    marketplace: string;
    preview: ProductPreview | null;
    mode: "parsed" | "fallback";
    message: string;
  }>(response);
}

export async function createPickupOrder(payload: {
  orderType: "pickup_standard" | "pickup_paid";
  marketplace: string;
  firstName: string;
  lastName: string;
  phone: string;
  itemCount: string;
  totalAmount: string;
  sourceUrl?: string;
  attachment?: File;
}) {
  const formData = new FormData();
  formData.set("orderType", payload.orderType);
  formData.set("marketplace", payload.marketplace);
  formData.set("firstName", payload.firstName);
  formData.set("lastName", payload.lastName);
  formData.set("phone", payload.phone);
  formData.set("itemCount", payload.itemCount);
  formData.set("totalAmount", payload.totalAmount);
  if (payload.sourceUrl) {
    formData.set("sourceUrl", payload.sourceUrl);
  }
  if (payload.attachment) {
    formData.set("attachment", payload.attachment);
  }

  const response = await fetch(`${API_BASE_URL}/orders/create`, {
    method: "POST",
    body: formData,
  });

  return parseResponse<{ order: OrderRecord; message: string }>(response);
}

export async function createHomeDeliveryOrder(payload: {
  marketplace: string;
  firstName: string;
  phone: string;
  deliveryAddress: string;
  sourceUrl: string;
  productPreview: ProductPreview | null;
}) {
  const formData = new FormData();
  formData.set("orderType", "home_delivery");
  formData.set("marketplace", payload.marketplace);
  formData.set("firstName", payload.firstName);
  formData.set("phone", payload.phone);
  formData.set("deliveryAddress", payload.deliveryAddress);
  formData.set("sourceUrl", payload.sourceUrl);
  formData.set("productPreview", JSON.stringify(payload.productPreview));

  const response = await fetch(`${API_BASE_URL}/orders/create`, {
    method: "POST",
    body: formData,
  });

  return parseResponse<{ order: OrderRecord; message: string }>(response);
}

export async function fetchOrder(orderNumber: string) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderNumber}`);
  return parseResponse<{ order: OrderRecord }>(response);
}

export async function cancelOrder(orderNumber: string) {
  const response = await fetch(`${API_BASE_URL}/orders/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderNumber }),
  });

  return parseResponse<{ order: OrderRecord; message: string }>(response);
}
