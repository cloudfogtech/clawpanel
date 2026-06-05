import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesCompressionConfigValues,
  mergeHermesCompressionConfig,
} from '../scripts/dev-api.js'

test('Hermes 压缩配置读取会提供上游默认值', () => {
  const values = buildHermesCompressionConfigValues({})

  assert.deepEqual(values, {
    enabled: true,
    threshold: 0.5,
    targetRatio: 0.2,
    protectLastN: 20,
    protectFirstN: 3,
    abortOnSummaryFailure: false,
  })
})

test('Hermes 压缩配置读取会回显 YAML 中的压缩字段', () => {
  const values = buildHermesCompressionConfigValues({
    compression: {
      enabled: false,
      threshold: 0.65,
      target_ratio: 0.35,
      protect_last_n: 30,
      protect_first_n: 0,
      abort_on_summary_failure: true,
    },
  })

  assert.equal(values.enabled, false)
  assert.equal(values.threshold, 0.65)
  assert.equal(values.targetRatio, 0.35)
  assert.equal(values.protectLastN, 30)
  assert.equal(values.protectFirstN, 0)
  assert.equal(values.abortOnSummaryFailure, true)
})

test('Hermes 压缩配置保存会保留无关 YAML 并写入 snake_case 字段', () => {
  const next = mergeHermesCompressionConfig({
    model: { provider: 'anthropic', default: 'claude-sonnet-4-6' },
    compression: {
      enabled: true,
      threshold: 0.5,
      custom_flag: 'keep-me',
    },
    streaming: { enabled: true },
  }, {
    enabled: false,
    threshold: '0.7',
    targetRatio: '0.4',
    protectLastN: '28',
    protectFirstN: '0',
    abortOnSummaryFailure: true,
  })

  assert.deepEqual(next.model, { provider: 'anthropic', default: 'claude-sonnet-4-6' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.compression.enabled, false)
  assert.equal(next.compression.threshold, 0.7)
  assert.equal(next.compression.target_ratio, 0.4)
  assert.equal(next.compression.protect_last_n, 28)
  assert.equal(next.compression.protect_first_n, 0)
  assert.equal(next.compression.abort_on_summary_failure, true)
  assert.equal(next.compression.custom_flag, 'keep-me')
})

test('Hermes 压缩配置保存会拒绝越界比例和消息数量', () => {
  assert.throws(
    () => mergeHermesCompressionConfig({}, { threshold: '0' }),
    /compression\.threshold/,
  )
  assert.throws(
    () => mergeHermesCompressionConfig({}, { targetRatio: '0.05' }),
    /compression\.target_ratio/,
  )
  assert.throws(
    () => mergeHermesCompressionConfig({}, { protectLastN: '0' }),
    /compression\.protect_last_n/,
  )
  assert.throws(
    () => mergeHermesCompressionConfig({}, { protectFirstN: '-1' }),
    /compression\.protect_first_n/,
  )
})
