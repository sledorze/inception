import { useCallback, useState } from 'react'

export interface AsyncFetchState<T> {
  readonly data: T | null
  readonly error: string | null
  readonly loading: boolean
  readonly refresh: () => void
}

export function useAsyncFetch<T>(fn: () => Promise<T>): AsyncFetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    fn()
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [fn])

  return { data, error, loading, refresh }
}
