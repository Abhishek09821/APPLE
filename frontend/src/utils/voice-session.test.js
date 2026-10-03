import test from 'node:test'
import assert from 'node:assert/strict'
import { VoiceSession } from './voice-session.js'

function setup(onCommand = () => {}) {
  const instances = [],
    commands = [],
    errors = []
  let scheduled
  class Recognition {
    constructor() {
      instances.push(this)
    }
    start() {
      this.onstart?.()
    }
    abort() {
      this.aborted = true
      this.onend?.()
    }
    result(text, isFinal = true) {
      const result = Object.assign([{ transcript: text }], { isFinal })
      this.onresult?.({ results: [result] })
    }
  }
  const session = new VoiceSession({
    Recognition,
    onState() {},
    onTranscript() {},
    onError: (e) => errors.push(e),
    onCommand: (text) => {
      commands.push(text)
      return onCommand(text)
    },
    schedule: (fn) => {
      scheduled = fn
      return 1
    },
    cancel: () => {
      scheduled = null
    },
  })
  return {
    session,
    instances,
    commands,
    errors,
    tick: () => {
      const fn = scheduled
      scheduled = null
      fn?.()
    },
  }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('a final utterance submits once, then listens again', async () => {
  const s = setup()
  s.session.enable()
  const rec = s.instances[0]
  rec.result('Hello')
  rec.result('Hello')
  assert.equal(s.commands.length, 0)
  rec.onend()
  rec.onend()
  await settle()
  assert.deepEqual(s.commands, ['Hello'])
  s.tick()
  assert.equal(s.instances.length, 2)
})
test('interim dictation never runs a command', async () => {
  const s = setup()
  s.session.enable()
  s.instances[0].result('Open', false)
  s.instances[0].onend()
  await settle()
  assert.deepEqual(s.commands, [])
})
test('stop discards late recognition events and pending submission', async () => {
  const s = setup()
  s.session.enable()
  const rec = s.instances[0],
    staleResult = rec.onresult,
    staleEnd = rec.onend
  rec.result('Open Notes')
  rec.onend()
  s.session.disable()
  staleResult({ results: [] })
  staleEnd()
  await settle()
  s.tick()
  assert.deepEqual(s.commands, [])
  assert.equal(s.instances.length, 1)
})
test('microphone stays paused throughout a request and spoken reply', async () => {
  let resolve
  const s = setup(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  s.session.enable()
  s.instances[0].result('Hello')
  s.instances[0].onend()
  await settle()
  s.tick()
  assert.equal(s.instances.length, 1)
  s.session.pause(true)
  resolve()
  await settle()
  s.tick()
  assert.equal(s.instances.length, 1)
  s.session.pause(false)
  s.tick()
  assert.equal(s.instances.length, 2)
})
test('permission errors end the session without a restart loop', () => {
  const s = setup()
  s.session.enable()
  s.instances[0].onerror({ error: 'not-allowed' })
  s.tick()
  assert.equal(s.session.enabled, false)
  assert.equal(s.instances.length, 1)
  assert.match(s.errors[0], /permission was denied/)
})
test('silence can restart, but suspending discards captured speech', async () => {
  const s = setup()
  s.session.enable()
  s.instances[0].onerror({ error: 'no-speech' })
  s.instances[0].onend()
  s.tick()
  assert.equal(s.instances.length, 2)
  const rec = s.instances[1],
    end = rec.onend
  rec.result('Open Notes')
  s.session.pause(true)
  end()
  await settle()
  assert.deepEqual(s.commands, [])
})
