import test from 'node:test'
import assert from 'node:assert/strict'
import { isPlaybackEcho } from './speech-echo.js'

test('speaker echo fragments are ignored but new speech can interrupt', () => {
  const output = 'Photosynthesis converts light into chemical energy. Plants use sunlight.'
  assert.equal(isPlaybackEcho('converts light into chemical energy', output), true)
  assert.equal(isPlaybackEcho('plants use sunlight', output), true)
  assert.equal(isPlaybackEcho('explain that more simply', output), false)
  assert.equal(isPlaybackEcho('wait', output), false)
  assert.equal(isPlaybackEcho('stop talking', 'You can stop talking now.'), false)
  assert.equal(isPlaybackEcho('Apple open Notes', output), false)
})
