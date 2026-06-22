import test from 'node:test'
import assert from 'node:assert/strict'

import { selectCalibrationSource } from '../scripts/dev-api.js'

test('calibration source keeps non-empty current config even when backup is richer', () => {
  const current = {
    models: { providers: {} },
    gateway: { auth: { mode: 'token', token: 'current-secret' } },
  }
  const backup = {
    models: { providers: { old: { type: 'openai', apiKey: 'old' } } },
    agents: { defaults: { workspace: '/tmp/work' }, list: [{ id: 'old-agent' }] },
    channels: { telegram: { enabled: true } },
    gateway: {
      auth: { mode: 'token', token: 'backup-secret' },
      controlUi: { allowedOrigins: ['http://localhost:3000'] },
    },
  }

  const [source, seed] = selectCalibrationSource(current, backup)

  assert.equal(source, 'current')
  assert.equal(seed, current)
})

test('calibration source falls back to backup only when current is empty', () => {
  const backup = { models: { providers: { old: { type: 'openai', apiKey: 'old' } } } }

  const [source, seed] = selectCalibrationSource({}, backup)

  assert.equal(source, 'backup')
  assert.equal(seed, backup)
})
