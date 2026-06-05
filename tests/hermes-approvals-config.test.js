import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesApprovalsConfigValues,
  mergeHermesApprovalsConfig,
} from '../scripts/dev-api.js'

test('Hermes 审批安全配置读取会提供上游默认值', () => {
  const values = buildHermesApprovalsConfigValues({})

  assert.deepEqual(values, {
    approvalMode: 'manual',
    approvalTimeout: 60,
    approvalCronMode: 'deny',
    approvalMcpReloadConfirm: true,
    approvalDestructiveSlashConfirm: true,
  })
})

test('Hermes 审批安全配置读取会回显 YAML 字段', () => {
  const values = buildHermesApprovalsConfigValues({
    approvals: {
      mode: 'smart',
      timeout: 120,
      cron_mode: 'approve',
      mcp_reload_confirm: false,
      destructive_slash_confirm: false,
    },
  })

  assert.equal(values.approvalMode, 'smart')
  assert.equal(values.approvalTimeout, 120)
  assert.equal(values.approvalCronMode, 'approve')
  assert.equal(values.approvalMcpReloadConfirm, false)
  assert.equal(values.approvalDestructiveSlashConfirm, false)
})

test('Hermes 审批安全配置保存会保留未知字段并写入 approvals', () => {
  const next = mergeHermesApprovalsConfig({
    model: { provider: 'anthropic' },
    approvals: {
      mode: 'manual',
      custom_flag: 'keep-approvals',
    },
    streaming: { enabled: true },
  }, {
    approvalMode: 'off',
    approvalTimeout: '15',
    approvalCronMode: 'approve',
    approvalMcpReloadConfirm: false,
    approvalDestructiveSlashConfirm: false,
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.approvals.mode, 'off')
  assert.equal(next.approvals.timeout, 15)
  assert.equal(next.approvals.cron_mode, 'approve')
  assert.equal(next.approvals.mcp_reload_confirm, false)
  assert.equal(next.approvals.destructive_slash_confirm, false)
  assert.equal(next.approvals.custom_flag, 'keep-approvals')
})

test('Hermes 审批安全配置保存会拒绝非法枚举和越界值', () => {
  assert.throws(
    () => mergeHermesApprovalsConfig({}, { approvalMode: 'always' }),
    /approvals\.mode/,
  )
  assert.throws(
    () => mergeHermesApprovalsConfig({}, { approvalCronMode: 'prompt' }),
    /approvals\.cron_mode/,
  )
  assert.throws(
    () => mergeHermesApprovalsConfig({}, { approvalTimeout: '0' }),
    /approvals\.timeout/,
  )
  assert.throws(
    () => mergeHermesApprovalsConfig({}, { approvalTimeout: '86401' }),
    /approvals\.timeout/,
  )
})
