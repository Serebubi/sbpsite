import fs from "node:fs/promises";
import path from "node:path";

import { orderSchema, type OrderRecord } from "shared";

import { config } from "../config.js";

interface OrderDatabase {
  orders: OrderRecord[];
}

async function ensureDatabase() {
  await fs.mkdir(path.dirname(config.dataFile), { recursive: true });

  try {
    await fs.access(config.dataFile);
  } catch {
    await fs.writeFile(config.dataFile, JSON.stringify({ orders: [] }, null, 2), "utf8");
  }
}

async function readDatabase(): Promise<OrderDatabase> {
  await ensureDatabase();
  const raw = await fs.readFile(config.dataFile, "utf8");
  const parsed = JSON.parse(raw) as OrderDatabase;
  return {
    orders: parsed.orders.map((entry) => orderSchema.parse(entry)),
  };
}

async function writeDatabase(data: OrderDatabase) {
  await ensureDatabase();
  await fs.writeFile(config.dataFile, JSON.stringify(data, null, 2), "utf8");
}

export class FileOrderRepository {
  async listOrders() {
    const data = await readDatabase();
    return data.orders;
  }

  async findByOrderNumber(orderNumber: string) {
    const data = await readDatabase();
    return data.orders.find((order) => order.orderNumber === orderNumber) ?? null;
  }

  async saveOrder(order: OrderRecord) {
    const data = await readDatabase();
    const nextOrders = data.orders.filter((entry) => entry.id !== order.id);
    nextOrders.push(orderSchema.parse(order));
    await writeDatabase({ orders: nextOrders.sort((left, right) => Number(left.orderNumber) - Number(right.orderNumber)) });
    return order;
  }
}
