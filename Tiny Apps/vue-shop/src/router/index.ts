import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", redirect: "/products" },
  {
    path: "/products",
    component: () => import("@/features/products/pages/ProductCatalogPage.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
