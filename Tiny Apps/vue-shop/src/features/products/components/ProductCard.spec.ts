import { Product } from '@/shared/api/generated/models'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createProductFixture } from '../fixtures/product.fixture'
import ProductCard from './ProductCard.vue'

function mountProductCard(productOverrides: Partial<Product> = {}) {
  return mount(ProductCard, {
    props: {
      product: createProductFixture(productOverrides)
    }
  })
}

describe('ProductCard', () => {
  it('should display the product name', () => {
    const productName = 'Custom product name'
    const wrapper = mountProductCard({ name: productName })

    expect(wrapper.get('[data-testid="product-card__name"]').text()).toBe(productName)
  })

  it('should display the formatted price', () => {
    const wrapper = mountProductCard({ price: 45 })

    expect(wrapper.get('[data-testid="product-card__price"]').text()).toBe('$45.00')
  })

  it('should display the product description', () => {
    const description = 'A lightweight running shoe'
    const wrapper = mountProductCard({ description })

    expect(wrapper.get('[data-testid="product-card__description"]').text()).toBe(description)
  })

  it('should display the correct image', () => {
    const productName = 'Image product'
    const imageUrl = '/round-corner.jpeg'
    const wrapper = mountProductCard({ name: productName, imageUrl })
    const image = wrapper.get('[data-testid="product-card__image"]')

    expect(image.attributes('src')).toBe(imageUrl)
    expect(image.attributes('alt')).toBe(productName)
  })
})
