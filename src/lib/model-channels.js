/**
 * 统一模型渠道 — 共享逻辑
 *
 * 渠道是唯一维护入口（Base URL + API Key + 模型列表），通过显式同步推送到
 * OpenClaw / Hermes / 晴辰助手。同步全部组合现有 API 完成：
 * - OpenClaw：read/write_openclaw_config（后端自带备份，合并保留未知字段）
 * - Hermes：hermes_env_set（写 .env）+ hermes_model_config_save（自带备份）
 * - 助手：一次性拷贝到 localStorage（clawpanel-assistant）
 * 本模块自身不直接写任何引擎配置文件。
 */
import { api } from './tauri-api.js'

export const ASSISTANT_STORAGE_KEY = 'clawpanel-assistant'

/** 渠道 apiType → Hermes transport 与回退 provider（仅 API Key 型三族可同步） */
export const HERMES_TRANSPORT_MAP = {
  'openai-completions': { transport: 'openai_chat', fallbackProvider: 'openai' },
  'anthropic-messages': { transport: 'anthropic_messages', fallbackProvider: 'anthropic' },
  'google-generative-ai': { transport: 'google_gemini', fallbackProvider: 'google' },
}

/** 晴辰助手支持的 apiType 族（见 assistant.js normalizeApiType） */
export const ASSISTANT_SUPPORTED_API_TYPES = [
  'openai-completions', 'anthropic-messages', 'google-generative-ai', 'ollama',
]

export function hermesSyncSupported(channel) {
  return Boolean(HERMES_TRANSPORT_MAP[channel?.apiType])
}

export function assistantSyncSupported(channel) {
  return ASSISTANT_SUPPORTED_API_TYPES.includes(channel?.apiType)
}

/**
 * 渠道内容指纹（djb2）：基于脱敏字段计算，用于「已同步 / 有未同步变更」徽标。
 * apiKeyMask 参与计算 —— Key 更换时掩码随之变化。
 */
export function channelFingerprint(channel) {
  const src = JSON.stringify([
    channel?.name || '',
    channel?.baseUrl || '',
    channel?.apiType || '',
    channel?.apiKeyMask || '',
    (channel?.models || []).map(m => m.id),
    channel?.defaultModel || '',
  ])
  let hash = 5381
  for (let i = 0; i < src.length; i += 1) {
    hash = ((hash << 5) + hash + src.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

/** OpenClaw providers 键：优先预设 key，否则由名称生成 slug */
export function channelProviderKey(channel) {
  const preset = String(channel?.presetKey || '').trim()
  if (preset) return preset
  const slug = String(channel?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `channel-${channel?.id || ''}`
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * 同步到 OpenClaw：只 upsert 渠道对应的 models.providers.{key}，
 * 展开旧对象保留未知字段；渠道模型为准但保留目标已有模型的测试元数据。
 */
export async function syncChannelToOpenclaw(channel, { setDefault = false } = {}) {
  const apiKey = await api.revealModelChannelKey(channel.id)
  const config = asObject(await api.readOpenclawConfig())
  config.models = asObject(config.models)
  config.models.providers = asObject(config.models.providers)
  const providerKey = channelProviderKey(channel)
  const existing = asObject(config.models.providers[providerKey])
  const existingModels = Array.isArray(existing.models) ? existing.models : []

  const models = (channel.models || []).map(model => {
    const prev = existingModels.find(e => (typeof e === 'string' ? e : e?.id) === model.id)
    const prevObj = prev && typeof prev === 'object' ? prev : {}
    const merged = { ...prevObj, id: model.id }
    if (model.name) merged.name = model.name
    if (model.contextWindow) merged.contextWindow = model.contextWindow
    return Object.keys(merged).length > 1 ? merged : model.id
  })

  config.models.providers[providerKey] = {
    ...existing,
    baseUrl: channel.baseUrl,
    api: channel.apiType,
    apiKey,
    models,
  }

  if (setDefault && channel.defaultModel) {
    config.agents = asObject(config.agents)
    config.agents.defaults = asObject(config.agents.defaults)
    config.agents.defaults.model = {
      ...asObject(config.agents.defaults.model),
      primary: `${providerKey}/${channel.defaultModel}`,
    }
  }

  await api.writeOpenclawConfig(config)
  return { providerKey, modelCount: models.length }
}

/** 解析渠道对应的 Hermes provider（API Key 型 + transport 匹配），不支持返回 null */
export async function resolveHermesTarget(channel) {
  const mapping = HERMES_TRANSPORT_MAP[channel?.apiType]
  if (!mapping) return null
  const raw = await api.hermesListProviders().catch(() => null)
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.providers) ? raw.providers : [])
  const usable = p => p
    && p.authType === 'api_key'
    && p.transport === mapping.transport
    && Array.isArray(p.apiKeyEnvVars) && p.apiKeyEnvVars.length > 0
  const byPreset = list.find(p => p.id === String(channel?.presetKey || '') && usable(p))
  const fallback = list.find(p => p.id === mapping.fallbackProvider && usable(p))
  return byPreset || fallback || null
}

/**
 * 同步到 Hermes：API Key 写入对应环境变量（Hermes .env），
 * 自定义 Base URL 写 baseUrlEnvVar；可选设为默认模型（config.yaml，自带备份）。
 */
export async function syncChannelToHermes(channel, { setDefault = false } = {}) {
  const target = await resolveHermesTarget(channel)
  if (!target) throw new Error('unsupported')
  const apiKey = await api.revealModelChannelKey(channel.id)
  if (!apiKey) throw new Error('no-key')

  await api.hermesEnvSet(target.apiKeyEnvVars[0], apiKey)

  const targetBase = String(target.baseUrl || '').replace(/\/+$/, '')
  const baseUrlDiffers = Boolean(channel.baseUrl) && channel.baseUrl !== targetBase
  if (baseUrlDiffers && target.baseUrlEnvVar) {
    await api.hermesEnvSet(target.baseUrlEnvVar, channel.baseUrl)
  }

  if (setDefault && channel.defaultModel) {
    const modelDefault = channel.defaultModel.includes('/')
      ? channel.defaultModel
      : `${target.id}/${channel.defaultModel}`
    await api.hermesModelConfigSave({
      modelDefault,
      modelProvider: target.id,
      modelBaseUrl: baseUrlDiffers && !target.baseUrlEnvVar ? channel.baseUrl : '',
    })
  }
  return { providerId: target.id, envKey: target.apiKeyEnvVars[0] }
}

/**
 * 同步到晴辰助手：一次性拷贝接入信息（渠道后续变更需再次同步）。
 * apiKey 由调用方 reveal 后传入，避免本模块内多次取明文。
 */
export function syncChannelToAssistant(channel, apiKey, model = '') {
  let config = {}
  try {
    config = JSON.parse(localStorage.getItem(ASSISTANT_STORAGE_KEY) || '{}') || {}
  } catch {
    config = {}
  }
  config.baseUrl = channel.baseUrl
  config.apiKey = apiKey
  config.model = model || channel.defaultModel || config.model || ''
  config.apiType = channel.apiType
  localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(config))
  return { model: config.model }
}

/** 从 OpenClaw 现有 providers 生成渠道（跳过已按 presetKey 存在的），用于冷启动导入 */
export async function importChannelsFromOpenclaw(existingChannels = []) {
  const config = await api.readOpenclawConfig().catch(() => null)
  const providers = asObject(asObject(config?.models).providers)
  const taken = new Set(existingChannels.map(c => c.presetKey).filter(Boolean))
  const imported = []
  for (const [key, provider] of Object.entries(providers)) {
    if (!provider || typeof provider !== 'object' || taken.has(key)) continue
    const models = (Array.isArray(provider.models) ? provider.models : [])
      .map(m => (typeof m === 'string' ? { id: m } : { id: String(m?.id || '').trim(), name: m?.name }))
      .filter(m => m.id)
    imported.push({
      id: `ch-${key}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
      name: key,
      presetKey: key,
      baseUrl: String(provider.baseUrl || '').trim().replace(/\/+$/, ''),
      apiType: String(provider.api || 'openai-completions').trim(),
      apiKey: String(provider.apiKey || ''),
      models,
      defaultModel: '',
      enabled: true,
    })
  }
  return imported
}
