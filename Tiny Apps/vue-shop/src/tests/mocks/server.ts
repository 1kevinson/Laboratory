import { productsHandlers } from '@/features/products/api/products.mocks'
import { setupServer } from 'msw/node'

export const server = setupServer(...productsHandlers)
