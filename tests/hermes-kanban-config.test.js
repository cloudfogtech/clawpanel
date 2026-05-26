import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesKanbanConfigValues,
  mergeHermesKanbanConfig,
} from '../scripts/dev-api.js'

test('Hermes Kanban 配置读取会提供上游默认值', () => {
  const values = buildHermesKanbanConfigValues({})

  assert.deepEqual(values, {
    dispatchInGateway: true,
    dispatchIntervalSeconds: 60,
    failureLimit: 2,
    autoDecompose: true,
    autoDecomposePerTick: 3,
    dispatchStaleTimeoutSeconds: 14400,
  })
})

test('Hermes Kanban 配置读取会规范化已有字段', () => {
  const values = buildHermesKanbanConfigValues({
    kanban: {
      dispatch_in_gateway: false,
      dispatch_interval_seconds: '120',
      failure_limit: '5',
      auto_decompose: false,
      auto_decompose_per_tick: '7',
      dispatch_stale_timeout_seconds: '7200',
    },
  })

  assert.equal(values.dispatchInGateway, false)
  assert.equal(values.dispatchIntervalSeconds, 120)
  assert.equal(values.failureLimit, 5)
  assert.equal(values.autoDecompose, false)
  assert.equal(values.autoDecomposePerTick, 7)
  assert.equal(values.dispatchStaleTimeoutSeconds, 7200)
})

test('Hermes Kanban 配置保存会保留未知 YAML 并写入 kanban', () => {
  const next = mergeHermesKanbanConfig({
    model: { provider: 'anthropic' },
    kanban: {
      dispatch_interval_seconds: 30,
      custom_flag: 'keep-me',
    },
    memory: { memory_enabled: true },
  }, {
    dispatchInGateway: false,
    dispatchIntervalSeconds: '15',
    failureLimit: '4',
    autoDecompose: false,
    autoDecomposePerTick: '2',
    dispatchStaleTimeoutSeconds: '0',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.memory, { memory_enabled: true })
  assert.equal(next.kanban.custom_flag, 'keep-me')
  assert.equal(next.kanban.dispatch_in_gateway, false)
  assert.equal(next.kanban.dispatch_interval_seconds, 15)
  assert.equal(next.kanban.failure_limit, 4)
  assert.equal(next.kanban.auto_decompose, false)
  assert.equal(next.kanban.auto_decompose_per_tick, 2)
  assert.equal(next.kanban.dispatch_stale_timeout_seconds, 0)
})

test('Hermes Kanban 配置保存会拒绝非法调度参数', () => {
  assert.throws(
    () => mergeHermesKanbanConfig({}, { dispatchIntervalSeconds: '0' }),
    /kanban\.dispatch_interval_seconds/,
  )
  assert.throws(
    () => mergeHermesKanbanConfig({}, { failureLimit: '0' }),
    /kanban\.failure_limit/,
  )
  assert.throws(
    () => mergeHermesKanbanConfig({}, { autoDecomposePerTick: '0' }),
    /kanban\.auto_decompose_per_tick/,
  )
  assert.throws(
    () => mergeHermesKanbanConfig({}, { dispatchStaleTimeoutSeconds: '-1' }),
    /kanban\.dispatch_stale_timeout_seconds/,
  )
  assert.throws(
    () => mergeHermesKanbanConfig({}, { dispatchStaleTimeoutSeconds: '604801' }),
    /kanban\.dispatch_stale_timeout_seconds/,
  )
  assert.throws(
    () => mergeHermesKanbanConfig({}, { dispatchStaleTimeoutSeconds: '12.5' }),
    /kanban\.dispatch_stale_timeout_seconds/,
  )
})
