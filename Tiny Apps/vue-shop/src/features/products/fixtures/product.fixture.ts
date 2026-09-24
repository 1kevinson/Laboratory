import { faker } from '@faker-js/faker'
import type { Product } from '@/shared/api/generated/models'

export function createProductFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: faker.number.float({ min: 1, max: 300, fractionDigits: 2 }),
    imageUrl: faker.image.url(),
    ...overrides,
  }
}
