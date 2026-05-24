import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesCronConfigValues,
  mergeHermesCronConfig,
} from '../scripts/dev-api.js'

test('Hermes 定时任务配置读取会提供上游默认值', () => {
  const values = buildHermesCronConfigValues({})

  assert.deepEqual(values, {
    cronWrapResponse: true,
    cronMaxParallelJobs: 0,
  })
})

test('Hermes 定时任务配置读取会回显 YAML 字段', () => {
  const values = buildHermesCronConfigValues({
    cron: {
      wrap_response: false,
      max_parallel_jobs: 4,
    },
  })

  assert.equal(values.cronWrapResponse, false)
  assert.equal(values.cronMaxParallelJobs, 4)
})

test('Hermes 定时任务配置保存会保留未知字段并写入 cron', () => {
  const next = mergeHermesCronConfig({
    cron: {
      wrap_response: true,
      custom_flag: 'keep-cron',
    },
    approvals: { cron_mode: 'deny' },
    streaming: { enabled: true },
  }, {
    cronWrapResponse: false,
    cronMaxParallelJobs: '3',
  })

  assert.deepEqual(next.approvals, { cron_mode: 'deny' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.cron.wrap_response, false)
  assert.equal(next.cron.max_parallel_jobs, 3)
  assert.equal(next.cron.custom_flag, 'keep-cron')
})

test('Hermes 定时任务配置保存 0 会写回不限制并拒绝越界值', () => {
  const next = mergeHermesCronConfig({
    cron: {
      max_parallel_jobs: 8,
    },
  }, {
    cronMaxParallelJobs: '0',
  })

  assert.equal(next.cron.max_parallel_jobs, null)

  assert.throws(
    () => mergeHermesCronConfig({}, { cronMaxParallelJobs: '-1' }),
    /cron\.max_parallel_jobs/,
  )
  assert.throws(
    () => mergeHermesCronConfig({}, { cronMaxParallelJobs: '10001' }),
    /cron\.max_parallel_jobs/,
  )
})
