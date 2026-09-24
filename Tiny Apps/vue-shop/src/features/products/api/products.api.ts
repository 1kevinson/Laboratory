import type { Product } from "@/shared/api/generated/models";
import { httpClient } from "@/shared/lib/http";

export async function getProducts(): Promise<Product[]> {
  const products = await httpClient<unknown>("/products");

  if (!Array.isArray(products)) {
    throw new TypeError("Invalid products response");
  }

  return products as Product[];
}
