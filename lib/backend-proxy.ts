const BACKEND_ORIGIN = process.env.LARAVEL_API_URL ?? 'http://127.0.0.1:8000'

export async function requestLaravel(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')

  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData

  if (init.body && !isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${BACKEND_ORIGIN}/api${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  const text = await response.text()
  const payload = text ? safeParseJson(text) : null

  return {
    response,
    payload,
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return {
      message: text,
    }
  }
}
