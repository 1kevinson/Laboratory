import { productsHandlers } from "@/features/products/api/products.mocks";
import { setupWorker } from "msw/browser";

export const worker = setupWorker(...productsHandlers);
