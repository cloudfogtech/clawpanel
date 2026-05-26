import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesUpdatesConfigValues,
  mergeHermesUpdatesConfig,
} from '../scripts/dev-api.js'

test('Hermes 更新配置读取会提供上游默认值', () => {
  const values = buildHermesUpdatesConfigValues({})

  assert.deepEqual(values, {
    updatesPreUpdateBackup: false,
    updatesBackupKeep: 5,
  })
})

test('Hermes 更新配置读取会回显 YAML 字段', () => {
  const values = buildHermesUpdatesConfigValues({
    updates: {
      pre_update_backup: true,
      backup_keep: 9,
    },
  })

  assert.equal(values.updatesPreUpdateBackup, true)
  assert.equal(values.updatesBackupKeep, 9)
})

test('Hermes 更新配置保存会保留未知字段并写入 updates', () => {
  const next = mergeHermesUpdatesConfig({
    updates: {
      pre_update_backup: false,
      custom_flag: 'keep-updates',
    },
    sessions: { auto_prune: true },
    model: { provider: 'anthropic' },
  }, {
    updatesPreUpdateBackup: true,
    updatesBackupKeep: '7',
  })

  assert.deepEqual(next.sessions, { auto_prune: true })
  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.equal(next.updates.pre_update_backup, true)
  assert.equal(next.updates.backup_keep, 7)
  assert.equal(next.updates.custom_flag, 'keep-updates')
})

test('Hermes 更新配置保存会拒绝非法保留数量', () => {
  assert.throws(
    () => mergeHermesUpdatesConfig({}, { updatesBackupKeep: '0' }),
    /updates\.backup_keep/,
  )
  assert.throws(
    () => mergeHermesUpdatesConfig({}, { updatesBackupKeep: '1001' }),
    /updates\.backup_keep/,
  )
})
