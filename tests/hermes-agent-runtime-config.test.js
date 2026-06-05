import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesAgentRuntimeConfigValues,
  mergeHermesAgentRuntimeConfig,
} from '../scripts/dev-api.js'

test('Hermes Agent 长跑保护配置读取会提供上游默认值', () => {
  const values = buildHermesAgentRuntimeConfigValues({})

  assert.deepEqual(values, {
    agentMaxTurns: 90,
    gatewayTimeout: 1800,
    restartDrainTimeout: 180,
    apiMaxRetries: 3,
    gatewayTimeoutWarning: 900,
    clarifyTimeout: 600,
    gatewayNotifyInterval: 180,
    gatewayAutoContinueFreshness: 3600,
    imageInputMode: 'auto',
    agentVerbose: false,
    reasoningEffort: 'medium',
    personalitiesJson: '{}',
  })
})

test('Hermes Agent 长跑保护配置读取会回显 YAML 字段', () => {
  const values = buildHermesAgentRuntimeConfigValues({
    agent: {
      max_turns: 240,
      gateway_timeout: 7200,
      restart_drain_timeout: 600,
      api_max_retries: 5,
      gateway_timeout_warning: 1200,
      clarify_timeout: 900,
      gateway_notify_interval: 240,
      gateway_auto_continue_freshness: 5400,
      image_input_mode: 'native',
      verbose: true,
      reasoning_effort: 'high',
      personalities: {
        concise: 'Keep answers short.',
        teacher: 'Explain with examples.',
      },
    },
  })

  assert.equal(values.agentMaxTurns, 240)
  assert.equal(values.gatewayTimeout, 7200)
  assert.equal(values.restartDrainTimeout, 600)
  assert.equal(values.apiMaxRetries, 5)
  assert.equal(values.gatewayTimeoutWarning, 1200)
  assert.equal(values.clarifyTimeout, 900)
  assert.equal(values.gatewayNotifyInterval, 240)
  assert.equal(values.gatewayAutoContinueFreshness, 5400)
  assert.equal(values.imageInputMode, 'native')
  assert.equal(values.agentVerbose, true)
  assert.equal(values.reasoningEffort, 'high')
  assert.deepEqual(JSON.parse(values.personalitiesJson), {
    concise: 'Keep answers short.',
    teacher: 'Explain with examples.',
  })
})

test('Hermes Agent 长跑保护配置保存会保留未知字段并写入 agent', () => {
  const next = mergeHermesAgentRuntimeConfig({
    model: { provider: 'anthropic' },
    agent: {
      max_turns: 90,
      disabled_toolsets: ['terminal'],
      custom_flag: 'keep-agent',
    },
    streaming: { enabled: true },
  }, {
    agentMaxTurns: '180',
    gatewayTimeout: '3600',
    restartDrainTimeout: '300',
    apiMaxRetries: '2',
    gatewayTimeoutWarning: '600',
    clarifyTimeout: '300',
    gatewayNotifyInterval: '120',
    gatewayAutoContinueFreshness: '1800',
    imageInputMode: 'text',
    agentVerbose: true,
    reasoningEffort: 'low',
    personalitiesJson: JSON.stringify({
      concise: ' Keep replies brief. ',
      ops: 'Focus on operational risk.',
    }),
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.agent.max_turns, 180)
  assert.equal(next.agent.gateway_timeout, 3600)
  assert.equal(next.agent.restart_drain_timeout, 300)
  assert.equal(next.agent.api_max_retries, 2)
  assert.equal(next.agent.gateway_timeout_warning, 600)
  assert.equal(next.agent.clarify_timeout, 300)
  assert.equal(next.agent.gateway_notify_interval, 120)
  assert.equal(next.agent.gateway_auto_continue_freshness, 1800)
  assert.equal(next.agent.image_input_mode, 'text')
  assert.equal(next.agent.verbose, true)
  assert.equal(next.agent.reasoning_effort, 'low')
  assert.deepEqual(next.agent.personalities, {
    concise: 'Keep replies brief.',
    ops: 'Focus on operational risk.',
  })
  assert.deepEqual(next.agent.disabled_toolsets, ['terminal'])
  assert.equal(next.agent.custom_flag, 'keep-agent')
})

test('Hermes Agent 长跑保护配置保存空人格会删除 personalities', () => {
  const next = mergeHermesAgentRuntimeConfig({
    agent: {
      personalities: {
        concise: 'Keep answers short.',
      },
      custom_flag: 'keep-agent',
    },
  }, {
    personalitiesJson: '{}',
  })

  assert.equal(next.agent.personalities, undefined)
  assert.equal(next.agent.custom_flag, 'keep-agent')
})

test('Hermes Agent 长跑保护配置保存允许 0 表示关闭或无限制', () => {
  const next = mergeHermesAgentRuntimeConfig({}, {
    gatewayTimeout: '0',
    restartDrainTimeout: '0',
    gatewayTimeoutWarning: '0',
    gatewayNotifyInterval: '0',
    gatewayAutoContinueFreshness: '0',
  })

  assert.equal(next.agent.gateway_timeout, 0)
  assert.equal(next.agent.restart_drain_timeout, 0)
  assert.equal(next.agent.gateway_timeout_warning, 0)
  assert.equal(next.agent.gateway_notify_interval, 0)
  assert.equal(next.agent.gateway_auto_continue_freshness, 0)
})

test('Hermes Agent 长跑保护配置保存会拒绝非法枚举和越界值', () => {
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { imageInputMode: 'pixel' }),
    /agent\.image_input_mode/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { agentMaxTurns: '0' }),
    /agent\.max_turns/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { apiMaxRetries: '0' }),
    /agent\.api_max_retries/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { clarifyTimeout: '-1' }),
    /agent\.clarify_timeout/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { reasoningEffort: 'maximum' }),
    /agent\.reasoning_effort/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { personalitiesJson: '{"bad name":"x"}' }),
    /agent\.personalities\.bad name/,
  )
  assert.throws(
    () => mergeHermesAgentRuntimeConfig({}, { personalitiesJson: '{"concise":123}' }),
    /agent\.personalities\.concise/,
  )
})
