import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesQuickCommandsConfigValues,
  mergeHermesQuickCommandsConfig,
} from '../scripts/dev-api.js'

test('Hermes 快捷命令配置读取会提供空对象默认值', () => {
  const values = buildHermesQuickCommandsConfigValues({})

  assert.equal(values.quickCommandsJson, '{}')
})

test('Hermes 快捷命令配置读取会格式化已有映射', () => {
  const values = buildHermesQuickCommandsConfigValues({
    quick_commands: {
      status: { type: 'exec', command: 'systemctl status hermes-agent' },
      restart: { type: 'alias', target: '/gateway restart' },
    },
  })

  assert.deepEqual(JSON.parse(values.quickCommandsJson), {
    status: { type: 'exec', command: 'systemctl status hermes-agent' },
    restart: { type: 'alias', target: '/gateway restart' },
  })
})

test('Hermes 快捷命令配置保存会保留无关 YAML 并写入顶层映射', () => {
  const next = mergeHermesQuickCommandsConfig({
    model: { provider: 'anthropic' },
    quick_commands: {
      old: { type: 'exec', command: 'uptime', custom_flag: 'drop-with-replace' },
    },
    memory: { memory_enabled: true },
  }, {
    quickCommandsJson: JSON.stringify({
      status: { type: 'exec', command: 'systemctl status hermes-agent', timeout: 10 },
      restart: { type: 'alias', target: '/gateway restart' },
    }),
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.memory, { memory_enabled: true })
  assert.deepEqual(next.quick_commands, {
    status: { type: 'exec', command: 'systemctl status hermes-agent', timeout: 10 },
    restart: { type: 'alias', target: '/gateway restart' },
  })
})

test('Hermes 快捷命令配置保存空对象会移除 quick_commands', () => {
  const next = mergeHermesQuickCommandsConfig({
    quick_commands: {
      status: { type: 'exec', command: 'uptime' },
    },
    streaming: { enabled: true },
  }, {
    quickCommandsJson: '{}',
  })

  assert.equal(next.quick_commands, undefined)
  assert.deepEqual(next.streaming, { enabled: true })
})

test('Hermes 快捷命令配置保存会拒绝非法 JSON 和非法命令结构', () => {
  assert.throws(
    () => mergeHermesQuickCommandsConfig({}, { quickCommandsJson: '[' }),
    /quick_commands/,
  )
  assert.throws(
    () => mergeHermesQuickCommandsConfig({}, { quickCommandsJson: '[]' }),
    /quick_commands/,
  )
  assert.throws(
    () => mergeHermesQuickCommandsConfig({}, { quickCommandsJson: JSON.stringify({ bad: 'uptime' }) }),
    /quick_commands\.bad/,
  )
  assert.throws(
    () => mergeHermesQuickCommandsConfig({}, { quickCommandsJson: JSON.stringify({ status: { type: 'exec', command: '' } }) }),
    /quick_commands\.status\.command/,
  )
  assert.throws(
    () => mergeHermesQuickCommandsConfig({}, { quickCommandsJson: JSON.stringify({ restart: { type: 'alias', target: 'gateway restart' } }) }),
    /quick_commands\.restart\.target/,
  )
})
