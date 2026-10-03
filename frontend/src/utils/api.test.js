import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { stream } from './api.js'

function mockStream(text) {
  const bytes = new TextEncoder().encode(text)
  mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/status')) return Response.json({ token: 'test-token' })
    return new Response(
      new ReadableStream({
        start(controller) {
          // Every byte arrives separately, including multibyte Unicode and frame delimiters.
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
          controller.close()
        },
      }),
    )
  })
}

test('stream preserves split frames and multibyte characters', async () => {
  mockStream(
    ': keepalive\n\ndata: {"type":"status","message":"Working…"}\n\ndata: {"type":"done","reply":"Hello 🌍"}\n\n',
  )
  const events = []
  try {
    await stream('/command/stream', { command: 'hello' }, (event) => events.push(event))
    assert.deepEqual(events, [
      { type: 'status', message: 'Working…' },
      { type: 'done', reply: 'Hello 🌍' },
    ])
  } finally {
    mock.restoreAll()
  }
})

test('stream reports a connection ending without a terminal result', async () => {
  mockStream('data: {"type":"status","message":"Working"}\n\n')
  try {
    await assert.rejects(
      stream('/command/stream', {}, () => {}),
      /before completion/,
    )
  } finally {
    mock.restoreAll()
  }
})

test('stream surfaces server errors without inventing a result', async () => {
  mock.method(globalThis, 'fetch', async () =>
    Response.json({ detail: 'Expired approval' }, { status: 410 }),
  )
  try {
    await assert.rejects(
      stream('/approvals/expired', {}, () => {}),
      /Expired approval/,
    )
  } finally {
    mock.restoreAll()
  }
})
