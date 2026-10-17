// Pembungkus fetch: cookie ikut otomatis (credentials), galat dilempar dengan pesan Indonesia.
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  const ct = res.headers.get('content-type') ?? ''
  const data: unknown =
    res.status === 204
      ? null
      : ct.includes('application/json')
        ? await res.json().catch(() => null)
        : ct.startsWith('application/pdf') || ct.startsWith('image/') || ct.startsWith('font/')
          ? await res.blob()
          : await res.text().catch(() => null)
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `Galat ${res.status}`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export const get = <T>(path: string) => api<T>(path)
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) })
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) })
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' })
