import test from 'node:test'
import assert from 'node:assert/strict'
import { VoiceSession } from './voice-session.js'

function setup(onCommand = () => {}, extra = {}) {
  const instances = [],
    commands = [],
    errors = []
  let scheduled
  class Recognition {
    constructor() {
      instances.push(this)
    }
    start(track) {
      this.track = track
      this.onstart?.()
    }
    abort() {
      this.aborted = true
      this.onend?.()
    }
    result(text, isFinal = true, confidence = 0.9) {
      const result = Object.assign([{ transcript: text, confidence }], { isFinal })
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
    ...extra,
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
test('microphone stays paused while a command is pending and explicitly suspended', async () => {
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
test('interim user speech interrupts once while playback echoes do not submit', async () => {
  const heard = []
  const s = setup(() => {}, {
    acceptTranscript: (text) => text !== 'My spoken reply',
    onSpeech: (text) => heard.push(text),
  })
  s.session.enable()
  const rec = s.instances[0]
  rec.result('My spoken reply', false)
  assert.deepEqual(heard, [])
  rec.result('Wait a moment', false)
  rec.result('Wait a moment please', false)
  assert.deepEqual(heard, ['Wait a moment'])
  assert.deepEqual(s.commands, [])
  rec.result('Wait a moment please')
  rec.onend()
  await settle()
  assert.deepEqual(s.commands, ['Wait a moment please'])
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

test('recognition uses the processed track across restarts and releases it on Stop', async () => {
  const track = { kind: 'audio', readyState: 'live' }
  let releases = 0,
    captures = 0
  const s = setup(() => {}, {
    acquireInput: async () => {
      captures++
      return { track, release: () => releases++ }
    },
    getLanguage: () => 'hi-IN',
  })
  s.session.enable()
  await settle()
  assert.equal(s.instances[0].track, track)
  assert.equal(s.instances[0].lang, 'hi-IN')
  s.instances[0].onend()
  s.tick()
  assert.equal(s.instances[1].track, track)
  assert.equal(captures, 1)
  s.session.disable()
  assert.equal(releases, 1)
})

test('a late microphone grant cannot start recognition after Stop', async () => {
  let resolve,
    released = false
  const s = setup(() => {}, {
    acquireInput: () =>
      new Promise((r) => {
        resolve = r
      }),
  })
  s.session.enable()
  s.session.disable()
  resolve({
    track: {},
    release: () => {
      released = true
    },
  })
  await settle()
  assert.equal(released, true)
  assert.equal(s.instances.length, 0)
})

test('a positively low confidence transcript never executes', async () => {
  const s = setup()
  s.session.enable()
  s.instances[0].result('send hello to someone', true, 0.32)
  s.instances[0].onend()
  await settle()
  assert.deepEqual(s.commands, [])
  assert.match(s.errors[0], /didn’t catch/)
})
