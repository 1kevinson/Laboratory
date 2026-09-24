import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

// Démarre MSW pour toute la suite de tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Annule les handlers ajoutés via server.use() dans un test isolé
afterEach(() => server.resetHandlers())

afterAll(() => server.close())
