import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { onTestFinished } from 'vitest'
import { defineComponent, h } from 'vue'

// useQuery de TanStack Query requiert un QueryClient injecté via provide/inject
export function withSetup<T>(composable: () => T) {
  let result!: T
  const testQueryClient = createTestQueryClient()

  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div') // pas de template réel nécessaire
    }
  })

  const wrapper = mount(TestComponent, {
    global: { plugins: [[VueQueryPlugin, { queryClient: testQueryClient }]] }
  })

  onTestFinished(() => {
    wrapper.unmount()
    testQueryClient.clear() // sécurité supplémentaire, même si gcTime:0 le rend redondant
  })

  return {
    result,
    testApp: wrapper,
    testQueryClient // exposé au cas où un test veut queryClient.clear() explicitement
  }
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // pas d'attente sur les erreurs simulées
        gcTime: 0 // pas de rétention de cache après unmount du composant dans le test
      }
    }
  })
}
