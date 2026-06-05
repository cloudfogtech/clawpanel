import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesAgentToolsetsConfigValues,
  buildHermesPlatformToolsetsConfigValues,
  mergeHermesAgentToolsetsConfig,
  mergeHermesPlatformToolsetsConfig,
} from '../scripts/dev-api.js'

test('Hermes Agent 工具集配置读取会提供上游默认值', () => {
  const values = buildHermesAgentToolsetsConfigValues({})

  assert.deepEqual(values, {
    disabledToolsets: '',
  })
})

test('Hermes Agent 工具集配置读取会回显全局禁用列表', () => {
  const values = buildHermesAgentToolsetsConfigValues({
    agent: {
      disabled_toolsets: ['memory', 'web', 'browser'],
    },
  })

  assert.equal(values.disabledToolsets, 'memory\nweb\nbrowser')
})

test('Hermes Agent 工具集配置保存会去重并保留未知字段', () => {
  const next = mergeHermesAgentToolsetsConfig({
    model: { provider: 'anthropic' },
    agent: {
      disabled_toolsets: ['memory'],
      max_turns: 80,
      custom_flag: 'keep-agent',
    },
    streaming: { enabled: true },
  }, {
    disabledToolsets: ' terminal \n browser \n\n memory\nbrowser ',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.deepEqual(next.agent.disabled_toolsets, ['terminal', 'browser', 'memory'])
  assert.equal(next.agent.max_turns, 80)
  assert.equal(next.agent.custom_flag, 'keep-agent')
})

test('Hermes Agent 工具集配置保存空输入会写入空数组', () => {
  const next = mergeHermesAgentToolsetsConfig({
    agent: {
      disabled_toolsets: ['memory'],
      custom_flag: 'keep-agent',
    },
  }, {
    disabledToolsets: '  \n ',
  })

  assert.deepEqual(next.agent.disabled_toolsets, [])
  assert.equal(next.agent.custom_flag, 'keep-agent')
})

test('Hermes Agent 工具集配置保存会拒绝非法工具集名称', () => {
  assert.throws(
    () => mergeHermesAgentToolsetsConfig({}, { disabledToolsets: 'bad tool' }),
    /agent\.disabled_toolsets/,
  )
  assert.throws(
    () => mergeHermesAgentToolsetsConfig({}, { disabledToolsets: '../secret' }),
    /agent\.disabled_toolsets/,
  )
})

test('Hermes 平台工具集配置读取会提供上游默认映射', () => {
  const values = buildHermesPlatformToolsetsConfigValues({})
  const mapping = JSON.parse(values.platformToolsetsJson)

  assert.deepEqual(mapping.cli, ['hermes-cli'])
  assert.deepEqual(mapping.telegram, ['hermes-telegram'])
  assert.deepEqual(mapping.discord, ['hermes-discord'])
  assert.deepEqual(mapping.whatsapp, ['hermes-whatsapp'])
  assert.deepEqual(mapping.google_chat, ['hermes-google_chat'])
})

test('Hermes 平台工具集配置读取会回显 YAML 映射', () => {
  const values = buildHermesPlatformToolsetsConfigValues({
    platform_toolsets: {
      cli: ['web', 'terminal', 'file'],
      telegram: ['hermes-telegram'],
      custom_platform: ['safe'],
    },
  })
  const mapping = JSON.parse(values.platformToolsetsJson)

  assert.deepEqual(mapping.cli, ['web', 'terminal', 'file'])
  assert.deepEqual(mapping.telegram, ['hermes-telegram'])
  assert.deepEqual(mapping.custom_platform, ['safe'])
})

test('Hermes 平台工具集配置保存会保留未知字段并写入平台映射', () => {
  const next = mergeHermesPlatformToolsetsConfig({
    model: { provider: 'anthropic' },
    platform_toolsets: {
      cli: ['hermes-cli'],
    },
    agent: { max_turns: 80 },
  }, {
    platformToolsetsJson: JSON.stringify({
      cli: ['web', 'terminal', 'file', 'web'],
      telegram: ['hermes-telegram'],
      custom_platform: ['safe'],
    }),
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.agent, { max_turns: 80 })
  assert.deepEqual(next.platform_toolsets.cli, ['web', 'terminal', 'file'])
  assert.deepEqual(next.platform_toolsets.telegram, ['hermes-telegram'])
  assert.deepEqual(next.platform_toolsets.custom_platform, ['safe'])
})

test('Hermes 平台工具集配置保存会拒绝非法 JSON、平台名和工具集名', () => {
  assert.throws(
    () => mergeHermesPlatformToolsetsConfig({}, { platformToolsetsJson: '[' }),
    /platform_toolsets JSON/,
  )
  assert.throws(
    () => mergeHermesPlatformToolsetsConfig({}, { platformToolsetsJson: JSON.stringify({ 'bad platform': ['web'] }) }),
    /platform_toolsets\.bad platform/,
  )
  assert.throws(
    () => mergeHermesPlatformToolsetsConfig({}, { platformToolsetsJson: JSON.stringify({ cli: ['bad tool'] }) }),
    /platform_toolsets\.cli/,
  )
  assert.throws(
    () => mergeHermesPlatformToolsetsConfig({}, { platformToolsetsJson: JSON.stringify({ cli: [] }) }),
    /platform_toolsets\.cli/,
  )
})
