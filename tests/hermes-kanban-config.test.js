import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesKanbanConfigValues,
  mergeHermesKanbanConfig,
} from '../scripts/dev-api.js'

test('Hermes Kanban 配置读取会提供上游默认值', () => {
  const values = buildHermesKanbanConfigValues({})

  assert.deepEqual(values, {
    dispatchStaleTimeoutSeconds: 14400,
  })
})

test('Hermes Kanban 配置读取会规范化已有字段', () => {
  const values = buildHermesKanbanConfigValues({
    kanban: {
      dispatch_stale_timeout_seconds: '7200',
    },
  })

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
    dispatchStaleTimeoutSeconds: '0',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.memory, { memory_enabled: true })
  assert.equal(next.kanban.dispatch_interval_seconds, 30)
  assert.equal(next.kanban.custom_flag, 'keep-me')
  assert.equal(next.kanban.dispatch_stale_timeout_seconds, 0)
})

test('Hermes Kanban 配置保存会拒绝非法超时', () => {
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
