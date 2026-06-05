import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesModelCatalogConfigValues,
  mergeHermesModelCatalogConfig,
} from '../scripts/dev-api.js'

const DEFAULT_CATALOG_URL = 'https://hermes-agent.nousresearch.com/docs/api/model-catalog.json'

test('Hermes 模型目录配置读取会提供上游默认值', () => {
  const values = buildHermesModelCatalogConfigValues({})

  assert.deepEqual(values, {
    modelCatalogEnabled: true,
    modelCatalogUrl: DEFAULT_CATALOG_URL,
    modelCatalogTtlHours: 24,
    modelCatalogProvidersJson: '{}',
  })
})

test('Hermes 模型目录配置读取会回显 YAML 字段', () => {
  const values = buildHermesModelCatalogConfigValues({
    model_catalog: {
      enabled: false,
      url: 'https://example.com/catalog.json',
      ttl_hours: 6,
      providers: {
        openrouter: {
          url: 'https://mirror.example.com/openrouter.json',
        },
        nous: {
          url: 'https://mirror.example.com/nous.json',
        },
      },
    },
  })

  assert.equal(values.modelCatalogEnabled, false)
  assert.equal(values.modelCatalogUrl, 'https://example.com/catalog.json')
  assert.equal(values.modelCatalogTtlHours, 6)
  assert.deepEqual(JSON.parse(values.modelCatalogProvidersJson), {
    openrouter: { url: 'https://mirror.example.com/openrouter.json' },
    nous: { url: 'https://mirror.example.com/nous.json' },
  })
})

test('Hermes 模型目录配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesModelCatalogConfig({
    model: { provider: 'openrouter' },
    model_catalog: {
      enabled: false,
      url: 'https://old.example.com/catalog.json',
      ttl_hours: 12,
      providers: {
        openrouter: {
          url: 'https://old.example.com/openrouter.json',
        },
      },
      custom_flag: 'keep-catalog',
    },
    streaming: { enabled: true },
  }, {
    modelCatalogEnabled: true,
    modelCatalogUrl: 'https://catalog.example.com/model-catalog.json',
    modelCatalogTtlHours: 48,
    modelCatalogProvidersJson: JSON.stringify({
      openrouter: { url: 'https://catalog.example.com/openrouter.json' },
      nous: { url: 'https://catalog.example.com/nous.json' },
    }),
  })

  assert.deepEqual(next.model, { provider: 'openrouter' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.model_catalog.enabled, true)
  assert.equal(next.model_catalog.url, 'https://catalog.example.com/model-catalog.json')
  assert.equal(next.model_catalog.ttl_hours, 48)
  assert.equal(next.model_catalog.providers.openrouter.url, 'https://catalog.example.com/openrouter.json')
  assert.equal(next.model_catalog.providers.nous.url, 'https://catalog.example.com/nous.json')
  assert.equal(next.model_catalog.custom_flag, 'keep-catalog')
})

test('Hermes 模型目录配置保存空 provider 覆盖会移除 providers', () => {
  const next = mergeHermesModelCatalogConfig({
    model_catalog: {
      providers: {
        openrouter: { url: 'https://old.example.com/openrouter.json' },
      },
      custom_flag: 'keep-catalog',
    },
    streaming: { enabled: true },
  }, {
    modelCatalogProvidersJson: '{}',
  })

  assert.equal(Object.hasOwn(next.model_catalog, 'providers'), false)
  assert.equal(next.model_catalog.custom_flag, 'keep-catalog')
  assert.deepEqual(next.streaming, { enabled: true })
})

test('Hermes 模型目录配置保存会拒绝非法 URL、TTL 和 provider JSON', () => {
  assert.throws(
    () => mergeHermesModelCatalogConfig({}, { modelCatalogUrl: 'ftp://example.com/catalog.json' }),
    /model_catalog\.url/,
  )
  assert.throws(
    () => mergeHermesModelCatalogConfig({}, { modelCatalogTtlHours: 0 }),
    /model_catalog\.ttl_hours/,
  )
  assert.throws(
    () => mergeHermesModelCatalogConfig({}, { modelCatalogProvidersJson: '[' }),
    /model_catalog\.providers/,
  )
  assert.throws(
    () => mergeHermesModelCatalogConfig({}, { modelCatalogProvidersJson: JSON.stringify({ 'bad provider': { url: 'https://example.com/catalog.json' } }) }),
    /model_catalog\.providers\.bad provider/,
  )
  assert.throws(
    () => mergeHermesModelCatalogConfig({}, { modelCatalogProvidersJson: JSON.stringify({ openrouter: { url: 'file:///tmp/catalog.json' } }) }),
    /model_catalog\.providers\.openrouter\.url/,
  )
})
