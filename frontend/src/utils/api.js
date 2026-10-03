let token = ''
export async function api(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData))
    headers['Content-Type'] = 'application/json'
  if (options.method && options.method !== 'GET') {
    if (!token) await api('/status')
    headers['X-Apple-Token'] = token
  }
  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(
      typeof error.detail === 'string' ? error.detail : `Request failed (${res.status})`,
    )
  }
  if (options.stream) return res
  const data = await res.json()
  if (path === '/status') token = data.token
  return data
}
export async function stream(path, body, onEvent, signal) {
  const res = await api(path, {
    method: 'POST',
    body: JSON.stringify(body),
    stream: true,
    signal,
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminal = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const payload = event
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.slice(6))
          .join('\n')
        if (payload) {
          const data = JSON.parse(payload)
          if (['done', 'error', 'approval'].includes(data.type)) terminal = true
          onEvent(data)
        }
      }
      if (done) break
    }
    if (!terminal)
      throw new Error(
        'Connection ended before completion. Check Activity before retrying an action.',
      )
  } finally {
    reader.releaseLock()
  }
}
