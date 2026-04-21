import type { Metadata } from "next";

import { SuperboxApp } from "@/components/superbox-app";

export const metadata: Metadata = {
  title: "SUPERBOX",
  description: "Сервис оформления заказов SUPERBOX",
};

export default function SuperboxPage() {
  return <SuperboxApp />;
}
