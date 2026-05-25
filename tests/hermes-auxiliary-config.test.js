import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesAuxiliaryConfigValues,
  mergeHermesAuxiliaryConfig,
} from '../scripts/dev-api.js'

test('Hermes 辅助模型配置读取会提供上游默认值', () => {
  const values = buildHermesAuxiliaryConfigValues({})

  assert.deepEqual(values, {
    auxiliaryVisionProvider: 'auto',
    auxiliaryVisionModel: '',
    auxiliaryVisionTimeout: 30,
    auxiliaryVisionDownloadTimeout: 30,
    auxiliaryWebExtractProvider: 'auto',
    auxiliaryWebExtractModel: '',
    auxiliarySessionSearchProvider: 'auto',
    auxiliarySessionSearchModel: '',
    auxiliarySessionSearchTimeout: 30,
    auxiliarySessionSearchMaxConcurrency: 3,
  })
})

test('Hermes 辅助模型配置读取会回显 YAML 字段', () => {
  const values = buildHermesAuxiliaryConfigValues({
    auxiliary: {
      vision: {
        provider: 'openrouter',
        model: 'google/gemini-2.5-flash',
        timeout: 45,
        download_timeout: 60,
      },
      web_extract: {
        provider: 'main',
        model: 'local-summary',
      },
      session_search: {
        provider: 'nous',
        model: 'gemini-3-flash',
        timeout: 50,
        max_concurrency: 5,
      },
    },
  })

  assert.equal(values.auxiliaryVisionProvider, 'openrouter')
  assert.equal(values.auxiliaryVisionModel, 'google/gemini-2.5-flash')
  assert.equal(values.auxiliaryVisionTimeout, 45)
  assert.equal(values.auxiliaryVisionDownloadTimeout, 60)
  assert.equal(values.auxiliaryWebExtractProvider, 'main')
  assert.equal(values.auxiliaryWebExtractModel, 'local-summary')
  assert.equal(values.auxiliarySessionSearchProvider, 'nous')
  assert.equal(values.auxiliarySessionSearchModel, 'gemini-3-flash')
  assert.equal(values.auxiliarySessionSearchTimeout, 50)
  assert.equal(values.auxiliarySessionSearchMaxConcurrency, 5)
})

test('Hermes 辅助模型配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesAuxiliaryConfig({
    model: { provider: 'anthropic' },
    auxiliary: {
      vision: {
        provider: 'auto',
        custom_flag: 'keep-vision',
      },
      web_extract: {
        custom_flag: 'keep-web',
      },
      session_search: {
        extra_body: { enable_thinking: false },
        custom_flag: 'keep-search',
      },
      custom_task: {
        provider: 'main',
      },
    },
    streaming: { enabled: true },
  }, {
    auxiliaryVisionProvider: 'codex',
    auxiliaryVisionModel: 'gpt-5.3-codex',
    auxiliaryVisionTimeout: '40',
    auxiliaryVisionDownloadTimeout: '55',
    auxiliaryWebExtractProvider: 'gemini',
    auxiliaryWebExtractModel: 'gemini-3-flash',
    auxiliarySessionSearchProvider: 'ollama-cloud',
    auxiliarySessionSearchModel: 'gpt-oss:20b',
    auxiliarySessionSearchTimeout: '70',
    auxiliarySessionSearchMaxConcurrency: '6',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.auxiliary.vision.provider, 'codex')
  assert.equal(next.auxiliary.vision.model, 'gpt-5.3-codex')
  assert.equal(next.auxiliary.vision.timeout, 40)
  assert.equal(next.auxiliary.vision.download_timeout, 55)
  assert.equal(next.auxiliary.vision.custom_flag, 'keep-vision')
  assert.equal(next.auxiliary.web_extract.provider, 'gemini')
  assert.equal(next.auxiliary.web_extract.model, 'gemini-3-flash')
  assert.equal(next.auxiliary.web_extract.custom_flag, 'keep-web')
  assert.equal(next.auxiliary.session_search.provider, 'ollama-cloud')
  assert.equal(next.auxiliary.session_search.model, 'gpt-oss:20b')
  assert.equal(next.auxiliary.session_search.timeout, 70)
  assert.equal(next.auxiliary.session_search.max_concurrency, 6)
  assert.deepEqual(next.auxiliary.session_search.extra_body, { enable_thinking: false })
  assert.equal(next.auxiliary.session_search.custom_flag, 'keep-search')
  assert.deepEqual(next.auxiliary.custom_task, { provider: 'main' })
})

test('Hermes 辅助模型配置保存会拒绝非法 provider、模型名和越界值', () => {
  assert.throws(
    () => mergeHermesAuxiliaryConfig({}, { auxiliaryVisionProvider: 'bad-provider' }),
    /auxiliary\.vision\.provider/,
  )
  assert.throws(
    () => mergeHermesAuxiliaryConfig({}, { auxiliaryVisionModel: '../secret' }),
    /auxiliary\.vision\.model/,
  )
  assert.throws(
    () => mergeHermesAuxiliaryConfig({}, { auxiliaryVisionTimeout: '0' }),
    /auxiliary\.vision\.timeout/,
  )
  assert.throws(
    () => mergeHermesAuxiliaryConfig({}, { auxiliaryVisionDownloadTimeout: '0' }),
    /auxiliary\.vision\.download_timeout/,
  )
  assert.throws(
    () => mergeHermesAuxiliaryConfig({}, { auxiliarySessionSearchMaxConcurrency: '0' }),
    /auxiliary\.session_search\.max_concurrency/,
  )
})
