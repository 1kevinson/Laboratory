import type { Product } from "@/shared/api/generated/models";
import { server } from "@/tests/mocks/server";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { getProducts } from "./products.api";

describe("getProducts", () => {
  it("Should return the products", async () => {
    const products: Product[] = await getProducts();
    expect(products).toHaveLength(50);
  });

  it("rejects a non-array response", async () => {
    server.use(http.get("/api/products", () => HttpResponse.html("<html></html>")));

    await expect(getProducts()).rejects.toThrow("Invalid products response");
  });
});
