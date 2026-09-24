import { defineConfig } from 'orval'

export default defineConfig({
  'vue-shop': {
    input: {
      target: './openapi/shop.openapi.json',
    },
    output: {
      target: './src/shared/api/generated',
      schemas: './src/shared/api/generated/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      tsconfig: './tsconfig.app.json',
      override: {
        useTypeOverInterfaces: true,
        jsDoc: {
          filter: () => [],
        },
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
})
