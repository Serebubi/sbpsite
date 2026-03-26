import { describe, expect, it } from "vitest";

import {
  buildManualPreview,
  createPickupStandardOrderSchema,
  isSupportedDomainForMarketplace,
  marketplaceExampleUrls,
  previewLinkSchema,
} from "../src/index";

describe("shared schemas", () => {
  it("validates pickup order input", () => {
    const result = createPickupStandardOrderSchema.parse({
      orderType: "pickup_standard",
      marketplace: "wildberries",
      firstName: "Сергей",
      lastName: "Иванов",
      phone: "+79997776655",
      itemCount: 2,
      totalAmount: 3500,
      sourceUrl: "https://www.wildberries.ru/catalog/123/detail.aspx",
    });

    expect(result.marketplace).toBe("wildberries");
  });

  it("rejects unsupported preview link format", () => {
    expect(() =>
      previewLinkSchema.parse({
        marketplace: "ozon",
        url: "bad-link",
      }),
    ).toThrow();
  });

  it("matches a supported marketplace domain", () => {
    expect(isSupportedDomainForMarketplace("https://www.wildberries.ru/catalog/1/detail.aspx", "wildberries")).toBe(true);
    expect(isSupportedDomainForMarketplace("https://example.com/item", "wildberries")).toBe(false);
  });

  it("builds manual fallback preview", () => {
    const preview = buildManualPreview("https://example.com/item/super-box-pro", "avito");

    expect(preview.title).toContain("super box pro");
    expect(preview.parserMode).toBe("fallback");
  });

  it("provides example links for all marketplaces", () => {
    expect(marketplaceExampleUrls.wildberries).toContain("wildberries.ru");
    expect(marketplaceExampleUrls.ozon).toContain("ozon.ru");
    expect(Object.keys(marketplaceExampleUrls)).toHaveLength(13);
  });
});
