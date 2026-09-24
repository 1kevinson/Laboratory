import { fileURLToPath, URL } from "node:url";
import Components from "unplugin-vue-components/vite";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vite";
import vueDevTools from "vite-plugin-vue-devtools";

import { preloadFonts } from "./build/vite-plugin-preload-fonts";

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    Components({
      dirs: ["src/app", "src/features", "src/widgets"],
      deep: true,
      dts: "./components.d.ts",
    }),
    preloadFonts(),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // Injecté en tête de CHAQUE bloc <style lang="scss"> : c'est ce qui rend
        // les tokens et les mixins disponibles dans les SFC sans import manuel.
        //
        // ⚠️ N'injecter QUE des couches qui ne produisent aucun CSS. Chaque bloc
        // <style> est une compilation Sass indépendante : le CSS émis par une
        // couche listée ici serait recopié une fois par composant. Voir ADR 008.
        additionalData: `
          @use "@/shared/styles/1-settings" as *;
          @use "@/shared/styles/2-tools" as *;
        `,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
