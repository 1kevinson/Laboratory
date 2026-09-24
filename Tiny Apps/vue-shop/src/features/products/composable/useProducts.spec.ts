import { server } from '@/tests/mocks/server'
import { withSetup } from '@/tests/utils/with-setup'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useProducts } from './useProducts'

describe('useProducts', () => {
  it('starts in a pending state before data resolves', () => {
    const { result } = withSetup(() => useProducts())
    expect(result.isPending.value).toBe(true)
    expect(result.data.value).toBeUndefined()
  })

  it('returns the list of products on success', async () => {
    const { result } = withSetup(() => useProducts())

    await vi.waitFor(() => {
      expect(result.isPending.value).toBe(false)
    })

    expect(result.isError.value).toBe(false)
    expect(result.data.value).toHaveLength(50)
    expect(result.data.value?.[0]).toMatchObject({
      id: 'a8c0f62c-96e0-4386-b614-09b8b0a12d16',
      name: 'Ferrari 250 GT California'
    })
  })

  it('exposes an error state when the API call fails', async () => {
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })
      })
    )

    const { result } = withSetup(() => useProducts())

    await vi.waitFor(() => {
      expect(result.isError.value).toBe(true)
    })

    expect(result.data.value).toBeUndefined()
    expect(result.error.value).toBeDefined()
  })
})
