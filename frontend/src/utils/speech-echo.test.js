import test from 'node:test'
import assert from 'node:assert/strict'
import { isPlaybackEcho, PlaybackEchoGuard } from './speech-echo.js'

test('speaker echo fragments are ignored but new speech can interrupt', () => {
  const output = 'Photosynthesis converts light into chemical energy. Plants use sunlight.'
  assert.equal(isPlaybackEcho('converts light into chemical energy', output), true)
  assert.equal(isPlaybackEcho('plants use sunlight', output), true)
  assert.equal(isPlaybackEcho('explain that more simply', output), false)
  assert.equal(isPlaybackEcho('wait', output), false)
  assert.equal(isPlaybackEcho('stop talking', 'You can stop talking now.'), true)
  assert.equal(isPlaybackEcho('Apple open Notes', output), false)
})

test('assistant names and interrupt words cannot bypass echo matching', () => {
  assert.equal(isPlaybackEcho('Apple is ready', 'Apple is ready to help.'), true)
  assert.equal(isPlaybackEcho('wait a moment', 'Please wait a moment.'), true)
  assert.equal(isPlaybackEcho('hi', 'This is a reply'), false)
  assert.equal(isPlaybackEcho('मुझे बताओ', 'अब मुझे बताओ क्या हुआ'), true)
})

test('delayed echoes use actual speech and previous replies without blocking short lesson answers', () => {
  let now = 0
  const guard = new PlaybackEchoGuard(() => now)
  const finish = guard.begin('Plants need sunlight. The details are on screen.')
  assert.equal(guard.accepts('The details are on screen'), false)
  assert.equal(guard.accepts('Explain gravity instead'), true)
  finish()
  now = 1600
  guard.begin('Here is another reply.')()
  assert.equal(guard.accepts('Plants need sunlight'), false)
  assert.equal(guard.accepts('sunlight'), true)
  now = 8100
  assert.equal(guard.accepts('Plants need sunlight'), true)
})
