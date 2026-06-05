import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesHooksConfigValues,
  mergeHermesHooksConfig,
} from '../scripts/dev-api.js'

test('Hermes hooks 配置读取会提供安全默认值', () => {
  const values = buildHermesHooksConfigValues({})

  assert.deepEqual(values, {
    hooksAutoAccept: false,
    hooksJson: '{}',
  })
})

test('Hermes hooks 配置读取会格式化事件映射', () => {
  const values = buildHermesHooksConfigValues({
    hooks_auto_accept: true,
    hooks: {
      pre_tool_call: [
        {
          matcher: 'terminal',
          command: '~/.hermes/agent-hooks/block-rm-rf.sh',
          timeout: 10,
        },
      ],
      pre_llm_call: [
        {
          command: '~/.hermes/agent-hooks/inject-cwd-context.sh',
        },
      ],
    },
  })
  const hooks = JSON.parse(values.hooksJson)

  assert.equal(values.hooksAutoAccept, true)
  assert.equal(hooks.pre_tool_call[0].matcher, 'terminal')
  assert.equal(hooks.pre_tool_call[0].command, '~/.hermes/agent-hooks/block-rm-rf.sh')
  assert.equal(hooks.pre_tool_call[0].timeout, 10)
  assert.equal(hooks.pre_llm_call[0].command, '~/.hermes/agent-hooks/inject-cwd-context.sh')
})

test('Hermes hooks 配置保存会保留未知字段并写入 hooks', () => {
  const next = mergeHermesHooksConfig({
    model: { provider: 'openrouter' },
    hooks: {
      pre_tool_call: [
        {
          matcher: 'terminal',
          command: 'old-hook.sh',
          extra_flag: 'keep-old',
        },
      ],
    },
    memory: { memory_enabled: true },
  }, {
    hooksAutoAccept: 'true',
    hooksJson: JSON.stringify({
      pre_tool_call: [
        {
          matcher: 'terminal',
          command: '~/.hermes/agent-hooks/block-rm-rf.sh',
          timeout: 10,
          extra_flag: 'keep-hook',
        },
      ],
      post_tool_call: [
        {
          matcher: 'write_file|patch',
          command: '~/.hermes/agent-hooks/auto-format.sh',
        },
      ],
    }),
  })

  assert.deepEqual(next.model, { provider: 'openrouter' })
  assert.deepEqual(next.memory, { memory_enabled: true })
  assert.equal(next.hooks_auto_accept, true)
  assert.equal(next.hooks.pre_tool_call[0].command, '~/.hermes/agent-hooks/block-rm-rf.sh')
  assert.equal(next.hooks.pre_tool_call[0].timeout, 10)
  assert.equal(next.hooks.pre_tool_call[0].extra_flag, 'keep-hook')
  assert.equal(next.hooks.post_tool_call[0].matcher, 'write_file|patch')
})

test('Hermes hooks 配置保存空对象会移除 hooks 但保留自动接受开关', () => {
  const next = mergeHermesHooksConfig({
    hooks_auto_accept: true,
    hooks: {
      pre_tool_call: [{ command: 'old-hook.sh' }],
    },
    streaming: { enabled: true },
  }, {
    hooksAutoAccept: false,
    hooksJson: '{}',
  })

  assert.equal(next.hooks, undefined)
  assert.equal(next.hooks_auto_accept, false)
  assert.deepEqual(next.streaming, { enabled: true })
})

test('Hermes hooks 配置保存会拒绝非法 JSON、事件、结构、命令和超时', () => {
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: '[' }),
    /hooks JSON/,
  )
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: JSON.stringify({ bad_event: [{ command: 'hook.sh' }] }) }),
    /hooks\.bad_event/,
  )
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: JSON.stringify({ pre_tool_call: { command: 'hook.sh' } }) }),
    /hooks\.pre_tool_call/,
  )
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: JSON.stringify({ pre_tool_call: ['hook.sh'] }) }),
    /hooks\.pre_tool_call\.0/,
  )
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: JSON.stringify({ pre_tool_call: [{ command: '' }] }) }),
    /hooks\.pre_tool_call\.0\.command/,
  )
  assert.throws(
    () => mergeHermesHooksConfig({}, { hooksJson: JSON.stringify({ pre_tool_call: [{ command: 'hook.sh', timeout: 0 }] }) }),
    /hooks\.pre_tool_call\.0\.timeout/,
  )
})
