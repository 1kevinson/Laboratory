import { server } from '@/tests/mocks/server'
import { createTestQueryClient } from '@/tests/utils/with-setup'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import ProductGrid from './ProductGrid.vue'

// Contrairement à ProductGrid.spec.ts, useProducts n'est pas mocké ici : seul le réseau l'est (MSW).
// Ce test couvre le câblage réel composant <-> composable <-> API.
function mountProductGrid() {
  return mount(ProductGrid, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createTestQueryClient() }]]
    }
  })
}

describe('ProductGrid (integration)', () => {
  it('should render the products returned by the API', async () => {
    const wrapper = mountProductGrid()

    expect(wrapper.find('[data-testid="loading-state"]').exists()).toBe(true)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="product-grid"]').exists()).toBe(true)
    })

    expect(wrapper.findAll('[data-testid="product-card"]')).toHaveLength(50)
    expect(wrapper.get('[data-testid="product-card__name"]').text()).toBe('Ferrari 250 GT California')
  })

  it('should render the error state when the API call fails', async () => {
    server.use(
      http.get('/api/products', () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
      )
    )

    const wrapper = mountProductGrid()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="error-state"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="product-grid"]').exists()).toBe(false)
  })
})
