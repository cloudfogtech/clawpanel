import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesSkillsConfigValues,
  mergeHermesSkillsConfig,
} from '../scripts/dev-api.js'

test('Hermes Skills 配置读取会提供上游默认值', () => {
  const values = buildHermesSkillsConfigValues({})

  assert.deepEqual(values, {
    creationNudgeInterval: 15,
    externalDirs: '',
    templateVars: true,
    inlineShell: false,
    inlineShellTimeout: 10,
    guardAgentCreated: false,
  })
})

test('Hermes Skills 配置读取会回显创建提醒和外部目录', () => {
  const values = buildHermesSkillsConfigValues({
    skills: {
      creation_nudge_interval: 30,
      external_dirs: ['~/.agents/skills', '/home/shared/team-skills'],
      template_vars: false,
      inline_shell: true,
      inline_shell_timeout: 25,
      guard_agent_created: true,
    },
  })

  assert.equal(values.creationNudgeInterval, 30)
  assert.equal(values.externalDirs, '~/.agents/skills\n/home/shared/team-skills')
  assert.equal(values.templateVars, false)
  assert.equal(values.inlineShell, true)
  assert.equal(values.inlineShellTimeout, 25)
  assert.equal(values.guardAgentCreated, true)
})

test('Hermes Skills 配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesSkillsConfig({
    model: { provider: 'anthropic' },
    skills: {
      creation_nudge_interval: 15,
      disabled: ['legacy-skill'],
      custom_flag: 'keep-skills',
    },
    memory: { memory_enabled: true },
  }, {
    creationNudgeInterval: '0',
    externalDirs: ' ~/.agents/skills \n\n /home/shared/team-skills ',
    templateVars: false,
    inlineShell: true,
    inlineShellTimeout: '30',
    guardAgentCreated: true,
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.memory, { memory_enabled: true })
  assert.equal(next.skills.creation_nudge_interval, 0)
  assert.deepEqual(next.skills.external_dirs, ['~/.agents/skills', '/home/shared/team-skills'])
  assert.equal(next.skills.template_vars, false)
  assert.equal(next.skills.inline_shell, true)
  assert.equal(next.skills.inline_shell_timeout, 30)
  assert.equal(next.skills.guard_agent_created, true)
  assert.deepEqual(next.skills.disabled, ['legacy-skill'])
  assert.equal(next.skills.custom_flag, 'keep-skills')
})

test('Hermes Skills 配置保存会拒绝非法提醒间隔', () => {
  assert.throws(
    () => mergeHermesSkillsConfig({}, { creationNudgeInterval: '-1' }),
    /skills\.creation_nudge_interval/,
  )
  assert.throws(
    () => mergeHermesSkillsConfig({}, { creationNudgeInterval: '10001' }),
    /skills\.creation_nudge_interval/,
  )
  assert.throws(
    () => mergeHermesSkillsConfig({}, { inlineShellTimeout: '0' }),
    /skills\.inline_shell_timeout/,
  )
  assert.throws(
    () => mergeHermesSkillsConfig({}, { inlineShellTimeout: '86401' }),
    /skills\.inline_shell_timeout/,
  )
})
