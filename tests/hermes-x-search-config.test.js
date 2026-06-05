import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesXSearchConfigValues,
  mergeHermesXSearchConfig,
} from '../scripts/dev-api.js'

test('Hermes X 搜索配置读取会提供上游默认值', () => {
  const values = buildHermesXSearchConfigValues({})

  assert.deepEqual(values, {
    xSearchModel: 'grok-4.20-reasoning',
    xSearchTimeoutSeconds: 180,
    xSearchRetries: 2,
  })
})

test('Hermes X 搜索配置读取会回显 YAML 字段', () => {
  const values = buildHermesXSearchConfigValues({
    x_search: {
      model: 'grok-4.20-fast',
      timeout_seconds: 90,
      retries: 4,
    },
  })

  assert.equal(values.xSearchModel, 'grok-4.20-fast')
  assert.equal(values.xSearchTimeoutSeconds, 90)
  assert.equal(values.xSearchRetries, 4)
})

test('Hermes X 搜索配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesXSearchConfig({
    model: { provider: 'xai' },
    x_search: {
      model: 'old-grok',
      timeout_seconds: 60,
      retries: 1,
      custom_flag: 'keep-x-search',
    },
    streaming: { enabled: true },
  }, {
    xSearchModel: 'grok-4.20-reasoning',
    xSearchTimeoutSeconds: 240,
    xSearchRetries: 3,
  })

  assert.deepEqual(next.model, { provider: 'xai' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.x_search.model, 'grok-4.20-reasoning')
  assert.equal(next.x_search.timeout_seconds, 240)
  assert.equal(next.x_search.retries, 3)
  assert.equal(next.x_search.custom_flag, 'keep-x-search')
})

test('Hermes X 搜索配置保存会拒绝非法模型、超时和重试次数', () => {
  assert.throws(
    () => mergeHermesXSearchConfig({}, { xSearchModel: '' }),
    /x_search\.model/,
  )
  assert.throws(
    () => mergeHermesXSearchConfig({}, { xSearchModel: 'bad model' }),
    /x_search\.model/,
  )
  assert.throws(
    () => mergeHermesXSearchConfig({}, { xSearchTimeoutSeconds: 29 }),
    /x_search\.timeout_seconds/,
  )
  assert.throws(
    () => mergeHermesXSearchConfig({}, { xSearchRetries: -1 }),
    /x_search\.retries/,
  )
  assert.throws(
    () => mergeHermesXSearchConfig({}, { xSearchRetries: 21 }),
    /x_search\.retries/,
  )
})
