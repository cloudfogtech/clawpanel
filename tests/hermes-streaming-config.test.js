import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesStreamingConfigValues,
  mergeHermesStreamingConfig,
} from '../scripts/dev-api.js'

test('Hermes 网关流式配置读取会提供上游默认值', () => {
  const values = buildHermesStreamingConfigValues({})

  assert.deepEqual(values, {
    enabled: false,
    transport: 'edit',
    editInterval: 0.8,
    bufferThreshold: 24,
    cursor: ' ▉',
    freshFinalAfterSeconds: 60,
  })
})

test('Hermes 网关流式配置读取会优先使用顶层 streaming 并兼容 gateway.streaming', () => {
  const fallbackValues = buildHermesStreamingConfigValues({
    gateway: {
      streaming: {
        enabled: true,
        transport: 'draft',
        edit_interval: 0.25,
        buffer_threshold: 11,
        cursor: '...',
        fresh_final_after_seconds: 0,
      },
    },
  })

  assert.equal(fallbackValues.enabled, true)
  assert.equal(fallbackValues.transport, 'draft')
  assert.equal(fallbackValues.editInterval, 0.25)
  assert.equal(fallbackValues.bufferThreshold, 11)
  assert.equal(fallbackValues.cursor, '...')
  assert.equal(fallbackValues.freshFinalAfterSeconds, 0)

  const topLevelValues = buildHermesStreamingConfigValues({
    streaming: {
      enabled: false,
      transport: 'auto',
      edit_interval: 0.5,
      buffer_threshold: 40,
      cursor: '>',
      fresh_final_after_seconds: 120,
    },
    gateway: {
      streaming: {
        enabled: true,
        transport: 'draft',
      },
    },
  })

  assert.equal(topLevelValues.enabled, false)
  assert.equal(topLevelValues.transport, 'auto')
  assert.equal(topLevelValues.editInterval, 0.5)
  assert.equal(topLevelValues.bufferThreshold, 40)
  assert.equal(topLevelValues.cursor, '>')
  assert.equal(topLevelValues.freshFinalAfterSeconds, 120)
})

test('Hermes 网关流式配置保存会写入顶层 streaming 并保留无关 YAML', () => {
  const next = mergeHermesStreamingConfig({
    model: { provider: 'anthropic' },
    streaming: {
      enabled: false,
      custom_flag: 'keep-me',
    },
    gateway: {
      streaming: {
        enabled: false,
        legacy_flag: 'keep-nested',
      },
    },
    display: {
      streaming: true,
    },
  }, {
    enabled: true,
    transport: 'draft',
    editInterval: '0.35',
    bufferThreshold: '48',
    cursor: '',
    freshFinalAfterSeconds: '0',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.equal(next.display.streaming, true)
  assert.equal(next.gateway.streaming.legacy_flag, 'keep-nested')
  assert.equal(next.streaming.enabled, true)
  assert.equal(next.streaming.transport, 'draft')
  assert.equal(next.streaming.edit_interval, 0.35)
  assert.equal(next.streaming.buffer_threshold, 48)
  assert.equal(next.streaming.cursor, '')
  assert.equal(next.streaming.fresh_final_after_seconds, 0)
  assert.equal(next.streaming.custom_flag, 'keep-me')
})

test('Hermes 网关流式配置保存会拒绝非法传输模式和越界节奏', () => {
  assert.throws(
    () => mergeHermesStreamingConfig({}, { transport: 'invalid' }),
    /streaming\.transport/,
  )
  assert.throws(
    () => mergeHermesStreamingConfig({}, { editInterval: '0.01' }),
    /streaming\.edit_interval/,
  )
  assert.throws(
    () => mergeHermesStreamingConfig({}, { bufferThreshold: '0' }),
    /streaming\.buffer_threshold/,
  )
  assert.throws(
    () => mergeHermesStreamingConfig({}, { freshFinalAfterSeconds: '-1' }),
    /streaming\.fresh_final_after_seconds/,
  )
})
