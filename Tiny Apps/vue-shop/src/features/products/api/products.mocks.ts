import { http, HttpResponse } from "msw";
import mockProducts from "./products.mocks.json";

export const productsHandlers = [
  http.get("*/api/products", () => {
    return HttpResponse.json(mockProducts);
  }),
];
