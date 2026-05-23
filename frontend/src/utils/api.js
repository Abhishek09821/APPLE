const BASE = 'http://localhost:8000'

export async function sendCommand(command) {
  const res = await fetch(`${BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

export async function sendCommandStream(command, onStep) {
  const res = await fetch(`${BASE}/command/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    const lines = text.split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6))
        onStep(data)
      } catch {}
    }
  }
}

export async function getHistory() {
  const res = await fetch(`${BASE}/history`)
  return res.json()
}

export async function getStatus() {
  const res = await fetch(`${BASE}/status`)
  return res.json()
}

export async function getScheduled() {
  const res = await fetch(`${BASE}/schedule`)
  return res.json()
}

export async function addSchedule(command, time) {
  const res = await fetch(`${BASE}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, time }),
  })
  return res.json()
}
