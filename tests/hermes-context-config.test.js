import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesContextConfigValues,
  mergeHermesContextConfig,
} from '../scripts/dev-api.js'

test('Hermes 上下文引擎配置读取会提供上游默认值', () => {
  const values = buildHermesContextConfigValues({})

  assert.deepEqual(values, {
    contextEngine: 'compressor',
  })
})

test('Hermes 上下文引擎配置读取会回显 YAML 字段', () => {
  const values = buildHermesContextConfigValues({
    context: {
      engine: 'lcm',
    },
  })

  assert.equal(values.contextEngine, 'lcm')
})

test('Hermes 上下文引擎配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesContextConfig({
    context: {
      engine: 'compressor',
      custom_flag: 'keep-context',
    },
    model: { provider: 'anthropic' },
    streaming: { enabled: true },
  }, {
    contextEngine: 'lcm',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.context.engine, 'lcm')
  assert.equal(next.context.custom_flag, 'keep-context')
})

test('Hermes 上下文引擎配置保存会拒绝非法引擎名', () => {
  assert.throws(
    () => mergeHermesContextConfig({}, { contextEngine: '' }),
    /context\.engine/,
  )
  assert.throws(
    () => mergeHermesContextConfig({}, { contextEngine: 'bad engine' }),
    /context\.engine/,
  )
  assert.throws(
    () => mergeHermesContextConfig({}, { contextEngine: '中文' }),
    /context\.engine/,
  )
})
