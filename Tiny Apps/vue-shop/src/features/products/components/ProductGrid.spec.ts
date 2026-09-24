import type { Product } from '@/shared/api/generated/models'
import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useProducts } from '../composable/useProducts'
import { createProductFixture } from '../fixtures/product.fixture'
import ProductCard from './ProductCard.vue'
import ProductGrid from './ProductGrid.vue'

type UseProductsReturn = ReturnType<typeof useProducts>

type UseProductsState = {
  data?: Product[]
  isPending?: boolean
  isError?: boolean
}

vi.mock('../composable/useProducts', () => ({
  useProducts: vi.fn<(...args: unknown[]) => unknown>()
}))

function mockUseProductsState({ data, isPending = false, isError = false }: UseProductsState = {}) {
  vi.mocked(useProducts).mockReturnValue({
    data: ref(data),
    isPending: ref(isPending),
    isError: ref(isError)
  } as unknown as UseProductsReturn)
}

function mountProductGrid() {
  return mount(ProductGrid, {
    global: {
      stubs: { ProductCard: true }
    }
  })
}

const STATES = ['loading-state', 'error-state', 'empty-state', 'product-grid'] as const

// Le template repose sur une chaîne v-if/v-else-if : vérifier l'état attendu ne suffit pas,
// il faut aussi garantir qu'aucun autre état n'est rendu en même temps.
function renderedStates(wrapper: VueWrapper) {
  return STATES.filter((state) => wrapper.find(`[data-testid="${state}"]`).exists())
}

describe('ProductGrid', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUseProductsState()
  })

  it('should display the pending state while products are loading', () => {
    mockUseProductsState({ isPending: true })

    const wrapper = mountProductGrid()

    expect(renderedStates(wrapper)).toEqual(['loading-state'])
  })

  it('should display the error state when the query fails', () => {
    mockUseProductsState({ isError: true })

    const wrapper = mountProductGrid()

    expect(renderedStates(wrapper)).toEqual(['error-state'])
  })

  it('should prioritize the pending state over the error state', () => {
    mockUseProductsState({ isPending: true, isError: true })

    const wrapper = mountProductGrid()

    expect(renderedStates(wrapper)).toEqual(['loading-state'])
  })

  it.each([
    ['undefined data', undefined],
    ['an empty list', []]
  ])('should display the empty state with %s', (_label, data) => {
    mockUseProductsState({ data })

    const wrapper = mountProductGrid()

    expect(renderedStates(wrapper)).toEqual(['empty-state'])
  })

  it('should render one card per product', () => {
    const products = [createProductFixture(), createProductFixture(), createProductFixture()]
    mockUseProductsState({ data: products })

    const wrapper = mountProductGrid()

    expect(renderedStates(wrapper)).toEqual(['product-grid'])
    expect(wrapper.findAllComponents(ProductCard)).toHaveLength(products.length)
  })
})
