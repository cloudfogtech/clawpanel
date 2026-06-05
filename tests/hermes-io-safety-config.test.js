import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesIoSafetyConfigValues,
  mergeHermesIoSafetyConfig,
} from '../scripts/dev-api.js'

test('Hermes 输入输出保护读取会提供上游默认值', () => {
  const values = buildHermesIoSafetyConfigValues({})

  assert.deepEqual(values, {
    fileReadMaxChars: 100000,
    toolOutputMaxBytes: 50000,
    toolOutputMaxLines: 2000,
    toolOutputMaxLineLength: 2000,
  })
})

test('Hermes 输入输出保护读取会回显 YAML 字段', () => {
  const values = buildHermesIoSafetyConfigValues({
    file_read_max_chars: 200000,
    tool_output: {
      max_bytes: 150000,
      max_lines: 5000,
      max_line_length: 4000,
    },
  })

  assert.equal(values.fileReadMaxChars, 200000)
  assert.equal(values.toolOutputMaxBytes, 150000)
  assert.equal(values.toolOutputMaxLines, 5000)
  assert.equal(values.toolOutputMaxLineLength, 4000)
})

test('Hermes 输入输出保护保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesIoSafetyConfig({
    model: { provider: 'anthropic' },
    file_read_max_chars: 100000,
    tool_output: {
      max_bytes: 50000,
      custom_flag: 'keep-output',
    },
    streaming: { enabled: true },
  }, {
    fileReadMaxChars: '120000',
    toolOutputMaxBytes: '80000',
    toolOutputMaxLines: '3000',
    toolOutputMaxLineLength: '2500',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.file_read_max_chars, 120000)
  assert.equal(next.tool_output.max_bytes, 80000)
  assert.equal(next.tool_output.max_lines, 3000)
  assert.equal(next.tool_output.max_line_length, 2500)
  assert.equal(next.tool_output.custom_flag, 'keep-output')
})

test('Hermes 输入输出保护保存会拒绝越界值', () => {
  assert.throws(
    () => mergeHermesIoSafetyConfig({}, { fileReadMaxChars: '999' }),
    /file_read_max_chars/,
  )
  assert.throws(
    () => mergeHermesIoSafetyConfig({}, { toolOutputMaxBytes: '999' }),
    /tool_output\.max_bytes/,
  )
  assert.throws(
    () => mergeHermesIoSafetyConfig({}, { toolOutputMaxLines: '0' }),
    /tool_output\.max_lines/,
  )
  assert.throws(
    () => mergeHermesIoSafetyConfig({}, { toolOutputMaxLineLength: '0' }),
    /tool_output\.max_line_length/,
  )
})
