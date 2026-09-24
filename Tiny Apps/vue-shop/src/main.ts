import { createApp } from "vue";

import "@/shared/styles/main.scss";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import { router } from "./router";

async function bootstrap() {
  // Bascule mock/backend réel pilotée par VITE_ENABLE_MOCKS (.env.development)
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === "true") {
    const { worker } = await import("./tests/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const app = createApp(App);

  app.use(VueQueryPlugin);
  app.use(router);
  app.mount("#app");
}

bootstrap();
