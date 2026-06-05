import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesPrivacyConfigValues,
  mergeHermesPrivacyConfig,
} from '../scripts/dev-api.js'

test('Hermes 隐私配置读取会提供上游默认值', () => {
  const values = buildHermesPrivacyConfigValues({})

  assert.deepEqual(values, {
    redactPii: false,
  })
})

test('Hermes 隐私配置读取会回显 YAML 字段', () => {
  const values = buildHermesPrivacyConfigValues({
    privacy: {
      redact_pii: true,
    },
  })

  assert.equal(values.redactPii, true)
})

test('Hermes 隐私配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesPrivacyConfig({
    model: { provider: 'anthropic' },
    privacy: {
      redact_pii: false,
      custom_flag: 'keep-privacy',
    },
    streaming: { enabled: true },
  }, {
    redactPii: true,
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.privacy.redact_pii, true)
  assert.equal(next.privacy.custom_flag, 'keep-privacy')
})
