import { showConfirm } from '../components/modal.js'
import { toast } from '../components/toast.js'
import { t } from '../lib/i18n.js'
import { icon } from '../lib/icons.js'
import { wsClient } from '../lib/ws-client.js'
import { navigate } from '../router.js'

let _page = null
let _unsubReady = null
let _state = createState()

function createState() {
  return {
    loading: true,
    actionLoading: false,
    view: 'scene',
    unsupported: false,
    error: '',
    status: null,
    configSnapshot: null,
    pluginId: 'memory-core',
    pluginSupportsDreaming: null,
    toggleBlockedReason: '',
    diaryPath: 'DREAMS.md',
    diaryContent: null,
  }
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizeInt(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

function normalizeEntries(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const record = asRecord(entry)
    if (!record) return null
    const snippet = normalizeString(record.snippet)
    const path = normalizeString(record.path)
    const key = normalizeString(record.key || path || snippet)
    if (!snippet && !path) return null
    return {
      key: key || `${path}:${normalizeInt(record.startLine, 1)}`,
      snippet,
      path,
      startLine: normalizeInt(record.startLine, 1),
      endLine: normalizeInt(record.endLine, 1),
      recallCount: normalizeInt(record.recallCount, 0),
      dailyCount: normalizeInt(record.dailyCount, 0),
      groundedCount: normalizeInt(record.groundedCount, 0),
      totalSignalCount: normalizeInt(record.totalSignalCount, 0),
      phaseHitCount: normalizeInt(record.phaseHitCount, 0),
      promotedAt: normalizeString(record.promotedAt || ''),
    }
  }).filter(Boolean)
}

function normalizePhase(raw) {
  const record = asRecord(raw)
  return {
    enabled: record?.enabled === true,
    cron: normalizeString(record?.cron),
    nextRunAtMs: typeof record?.nextRunAtMs === 'number' && Number.isFinite(record.nextRunAtMs) ? record.nextRunAtMs : null,
    limit: normalizeInt(record?.limit, 0),
    lookbackDays: normalizeInt(record?.lookbackDays, 0),
    minScore: typeof record?.minScore === 'number' && Number.isFinite(record.minScore) ? record.minScore : null,
    minPatternStrength: typeof record?.minPatternStrength === 'number' && Number.isFinite(record.minPatternStrength) ? record.minPatternStrength : null,
    minRecallCount: normalizeInt(record?.minRecallCount, 0),
    minUniqueQueries: normalizeInt(record?.minUniqueQueries, 0),
  }
}

function normalizeStatus(raw) {
  const record = asRecord(raw)
  if (!record) return null
  const phases = asRecord(record.phases)
  return {
    enabled: record.enabled === true,
    timezone: normalizeString(record.timezone || ''),
    storageMode: normalizeString(record.storageMode || 'inline'),
    shortTermCount: normalizeInt(record.shortTermCount, 0),
    groundedSignalCount: normalizeInt(record.groundedSignalCount, 0),
    totalSignalCount: normalizeInt(record.totalSignalCount, 0),
    promotedToday: normalizeInt(record.promotedToday, 0),
    promotedTotal: normalizeInt(record.promotedTotal, 0),
    storePath: normalizeString(record.storePath || 'MEMORY.md'),
    shortTermEntries: normalizeEntries(record.shortTermEntries),
    signalEntries: normalizeEntries(record.signalEntries),
    promotedEntries: normalizeEntries(record.promotedEntries),
    phases: {
      light: normalizePhase(phases?.light),
      deep: normalizePhase(phases?.deep),
      rem: normalizePhase(phases?.rem),
    },
  }
}

function isUnsupportedError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  return msg.includes('unknown method') || msg.includes('not found') || msg.includes('unsupported') || msg.includes('不支持')
}

function errorMessage(error) {
  return String(error?.message || error || '')
}

function lookupIncludesDreamingProperty(value) {
  const lookup = asRecord(value)
  const children = Array.isArray(lookup?.children) ? lookup.children : []
  return children.some((child) => normalizeString(asRecord(child)?.key) === 'dreaming')
}

function lookupDisallowsUnknownProperties(value) {
  const lookup = asRecord(value)
  const schema = asRecord(lookup?.schema)
  return schema?.additionalProperties === false
}

function parseDiarySections(content) {
  if (typeof content !== 'string') return []
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const matches = Array.from(normalized.matchAll(/^(#{1,6})\s+(.+)$/gm))
  if (!matches.length) {
    return [{ title: `${t('dreaming.diarySection')} 1`, body: normalized }]
  }
  const result = []
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]
    const start = (current.index ?? 0) + current[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length
    const title = normalizeString(current[2], `${t('dreaming.diarySection')} ${i + 1}`).trim() || `${t('dreaming.diarySection')} ${i + 1}`
    const body = normalized.slice(start, end).trim()
    result.push({ title, body: body || current[0] })
  }
  return result.filter((section) => section.title || section.body)
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatNextRun(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return t('dreaming.notScheduled')
  return new Date(ms).toLocaleString()
}

function resolveNextRun(status) {
  if (!status?.phases) return null
  const values = Object.values(status.phases)
    .filter((phase) => phase.enabled && typeof phase.nextRunAtMs === 'number')
    .map((phase) => phase.nextRunAtMs)
    .sort((a, b) => a - b)
  return values[0] ?? null
}

function resolveMemoryPluginId(config) {
  const root = asRecord(config)
  const plugins = asRecord(root?.plugins)
  const slots = asRecord(plugins?.slots)
  const slot = normalizeString(slots?.memory || '').trim()
  if (slot && slot.toLowerCase() !== 'none') return slot
  return 'memory-core'
}

async function ensureGatewayReady(page) {
  if (wsClient.connected && wsClient.gatewayReady) return true
  if (_unsubReady) { _unsubReady(); _unsubReady = null }
  _unsubReady = wsClient.onReady(() => {
    if (_unsubReady) { _unsubReady(); _unsubReady = null }
    if (_page === page) loadAll(page)
  })
  return false
}

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'
  _page = page
  _state = createState()
  renderPage(page)
  await loadAll(page)
  return page
}

export function cleanup() {
  _page = null
  if (_unsubReady) { _unsubReady(); _unsubReady = null }
}

async function loadAll(page) {
  if (_page !== page) return
  if (!(await ensureGatewayReady(page))) {
    _state.loading = false
    _state.actionLoading = false
    renderPage(page)
    return
  }

  _state.loading = true
  _state.error = ''
  _state.unsupported = false
  _state.toggleBlockedReason = ''
  _state.pluginSupportsDreaming = null
  renderPage(page)

  const [statusResult, diaryResult, configResult] = await Promise.allSettled([
    wsClient.request('doctor.memory.status', {}),
    wsClient.request('doctor.memory.dreamDiary', {}),
    wsClient.request('config.get', {}),
  ])

  if (_page !== page) return

  if (statusResult.status === 'fulfilled') {
    _state.status = normalizeStatus(statusResult.value?.dreaming ?? statusResult.value)
  } else {
    _state.status = null
    _state.error = errorMessage(statusResult.reason)
    _state.unsupported = isUnsupportedError(statusResult.reason)
  }

  if (diaryResult.status === 'fulfilled') {
    const payload = diaryResult.value || {}
    _state.diaryPath = normalizeString(payload.path || 'DREAMS.md')
    _state.diaryContent = payload.found === false ? null : (typeof payload.content === 'string' ? payload.content : null)
  } else if (!_state.error) {
    _state.error = errorMessage(diaryResult.reason)
  }

  if (configResult.status === 'fulfilled') {
    const snapshot = asRecord(configResult.value)
    _state.configSnapshot = snapshot && typeof snapshot.hash === 'string' ? snapshot : null
    _state.pluginId = resolveMemoryPluginId(_state.configSnapshot?.config)
    if (!_state.configSnapshot?.hash) {
      _state.toggleBlockedReason = t('dreaming.configUnavailable')
    } else {
      try {
        const lookup = await wsClient.request('config.schema.lookup', {
          path: `plugins.entries.${_state.pluginId}.config`,
        })
        const hasDreaming = lookupIncludesDreamingProperty(lookup)
        const strictSchema = lookupDisallowsUnknownProperties(lookup)
        if (hasDreaming) {
          _state.pluginSupportsDreaming = true
        } else if (strictSchema) {
          _state.pluginSupportsDreaming = false
          _state.toggleBlockedReason = t('dreaming.pluginUnsupported')
        }
      } catch (lookupError) {
        if (!isUnsupportedError(lookupError) && !_state.toggleBlockedReason) {
          _state.toggleBlockedReason = ''
        }
      }
    }
  } else {
    _state.configSnapshot = null
    _state.toggleBlockedReason = t('dreaming.configUnavailable')
  }

  _state.loading = false
  _state.actionLoading = false
  renderPage(page)
}

async function runAction(method, successText, options = {}) {
  if (!_page || _state.actionLoading) return
  if (!(wsClient.connected && wsClient.gatewayReady)) {
    toast(t('dreaming.gwWait'), 'warning')
    return
  }
  _state.actionLoading = true
  renderPage(_page)
  try {
    await wsClient.request(method, {})
    toast(successText, 'success')
    await loadAll(_page)
  } catch (e) {
    toast(`${t('dreaming.loadFailed')}: ${e?.message || e}`, 'error')
    _state.actionLoading = false
    renderPage(_page)
  }
}

async function toggleDreaming() {
  if (!_page || _state.actionLoading) return
  if (!(wsClient.connected && wsClient.gatewayReady)) {
    toast(t('dreaming.gwWait'), 'warning')
    return
  }
  if (_state.toggleBlockedReason) {
    toast(_state.toggleBlockedReason, 'warning')
    return
  }
  if (!_state.configSnapshot?.hash) {
    toast(t('dreaming.configUnavailable'), 'warning')
    return
  }
  if (_state.pluginSupportsDreaming === false) {
    toast(t('dreaming.pluginUnsupported'), 'warning')
    return
  }
  const enabled = _state.status?.enabled === true
  const pluginId = resolveMemoryPluginId(_state.configSnapshot.config)
  _state.actionLoading = true
  renderPage(_page)
  try {
    await wsClient.request('config.patch', {
      baseHash: _state.configSnapshot.hash,
      raw: JSON.stringify({
        plugins: {
          entries: {
            [pluginId]: {
              config: {
                dreaming: {
                  enabled: !enabled,
                },
              },
            },
          },
        },
      }),
      sessionKey: wsClient.sessionKey || undefined,
      note: 'Dreaming settings updated from ClawPanel.',
    })
    toast(!enabled ? t('dreaming.enabled') : t('dreaming.disabled'), 'success')
    await loadAll(_page)
  } catch (e) {
    const message = errorMessage(e)
    if (isUnsupportedError(e) && !_state.toggleBlockedReason) {
      _state.toggleBlockedReason = t('dreaming.pluginUnsupported')
    }
    toast(`${t('dreaming.toggleFailed')}: ${message}`, 'error')
    _state.actionLoading = false
    renderPage(_page)
  }
}

function renderStatCard(label, value, meta = '') {
  return `
    <div class="stat-card">
      <div class="stat-card-header"><span class="stat-card-label">${esc(label)}</span></div>
      <div class="stat-card-value">${esc(value)}</div>
      ${meta ? `<div class="stat-card-meta">${esc(meta)}</div>` : ''}
    </div>
  `
}

function renderPhaseCard(title, phase) {
  const meta = [
    phase.cron ? `${t('dreaming.cron')}: ${phase.cron}` : t('dreaming.notScheduled'),
    phase.nextRunAtMs ? `${t('dreaming.nextRun')}: ${formatNextRun(phase.nextRunAtMs)}` : '',
  ].filter(Boolean).join(' · ')

  const details = [
    phase.limit ? `limit ${phase.limit}` : '',
    phase.lookbackDays ? `lookback ${phase.lookbackDays}d` : '',
    typeof phase.minScore === 'number' ? `score≥${phase.minScore}` : '',
    typeof phase.minPatternStrength === 'number' ? `pattern≥${phase.minPatternStrength}` : '',
    phase.minRecallCount ? `recalls≥${phase.minRecallCount}` : '',
    phase.minUniqueQueries ? `uniq≥${phase.minUniqueQueries}` : '',
  ].filter(Boolean).join(' · ')

  return `
    <div class="config-section" style="margin:0">
      <div class="config-section-title" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${esc(title)}</span>
        <span class="badge${phase.enabled ? ' badge-success' : ''}">${esc(phase.enabled ? t('dreaming.statusEnabled') : t('dreaming.statusDisabled'))}</span>
      </div>
      <div class="form-hint">${esc(meta || t('dreaming.notScheduled'))}</div>
      ${details ? `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">${esc(details)}</div>` : ''}
    </div>
  `
}

function renderEntries(title, entries) {
  const content = entries.length
    ? entries.slice(0, 8).map((entry) => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border-primary)">
          <div style="font-size:13px;color:var(--text-primary);line-height:1.6">${esc(entry.snippet || '(empty)')}</div>
          <div style="margin-top:6px;font-size:12px;color:var(--text-secondary)">${esc(entry.path)}${entry.startLine ? ':' + entry.startLine : ''}${entry.endLine && entry.endLine !== entry.startLine ? '-' + entry.endLine : ''}</div>
          <div style="margin-top:4px;font-size:12px;color:var(--text-tertiary)">
            ${esc([
              entry.recallCount ? `${entry.recallCount} recall` : '',
              entry.dailyCount ? `${entry.dailyCount} daily` : '',
              entry.groundedCount ? `${entry.groundedCount} grounded` : '',
              entry.totalSignalCount ? `${entry.totalSignalCount} signals` : '',
              entry.phaseHitCount ? `${entry.phaseHitCount} ${t('dreaming.phaseHits')}` : '',
            ].filter(Boolean).join(' · '))}
          </div>
        </div>
      `).join('')
    : `<div class="form-hint">${esc(t('dreaming.noEntries'))}</div>`

  return `
    <div class="config-section" style="margin:0">
      <div class="config-section-title">${esc(title)}</div>
      ${content}
    </div>
  `
}

function renderActionButtons(enabled, disabledAttr) {
  const toggleText = enabled ? t('dreaming.toggleOff') : t('dreaming.toggleOn')
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm ${enabled ? 'btn-warning' : 'btn-primary'}" id="btn-dreaming-toggle" ${disabledAttr}>${esc(_state.actionLoading ? t('dreaming.actionRunning') : toggleText)}</button>
      <button class="btn btn-sm btn-secondary" id="btn-dreaming-backfill" ${disabledAttr}>${esc(t('dreaming.backfill'))}</button>
      <button class="btn btn-sm btn-secondary" id="btn-dreaming-reset-diary" ${disabledAttr}>${esc(t('dreaming.resetDiary'))}</button>
      <button class="btn btn-sm btn-secondary" id="btn-dreaming-clear-grounded" ${disabledAttr}>${esc(t('dreaming.clearGrounded'))}</button>
    </div>
  `
}

function renderStatusHints() {
  return `
    ${_state.toggleBlockedReason ? `<div class="form-hint" style="margin-top:10px">${esc(_state.toggleBlockedReason)}</div>` : ''}
    ${_state.error && !_state.unsupported ? `<div style="margin-top:12px;color:var(--warning)">${esc(_state.error)}</div>` : ''}
  `
}

function renderViewTabs() {
  return `
    <div class="tab-bar" style="margin-bottom:var(--space-lg)">
      <div class="tab${_state.view === 'scene' ? ' active' : ''}" data-dreaming-view="scene">${esc(t('dreaming.viewScene'))}</div>
      <div class="tab${_state.view === 'diary' ? ' active' : ''}" data-dreaming-view="diary">${esc(t('dreaming.viewDiary'))}</div>
    </div>
  `
}

function renderDreamLane(title, subtitle, entries, accent) {
  const tones = {
    violet: { border: 'rgba(168,85,247,0.35)', bg: 'linear-gradient(180deg, rgba(91,33,182,0.22), rgba(30,41,59,0.6))', glow: 'rgba(168,85,247,0.22)' },
    cyan: { border: 'rgba(34,211,238,0.35)', bg: 'linear-gradient(180deg, rgba(8,145,178,0.18), rgba(15,23,42,0.58))', glow: 'rgba(34,211,238,0.18)' },
    amber: { border: 'rgba(251,191,36,0.35)', bg: 'linear-gradient(180deg, rgba(180,83,9,0.18), rgba(30,41,59,0.58))', glow: 'rgba(251,191,36,0.18)' },
  }
  const tone = tones[accent] || tones.violet
  const items = entries.length
    ? entries.slice(0, 4).map((entry, idx) => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:${idx === entries.slice(0, 4).length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)'}">
          <div style="width:9px;height:9px;border-radius:999px;background:${tone.border};box-shadow:0 0 12px ${tone.glow};margin-top:6px;flex-shrink:0"></div>
          <div style="min-width:0">
            <div style="font-size:13px;line-height:1.6;color:var(--text-primary)">${esc(entry.snippet || '(empty)')}</div>
            <div style="margin-top:6px;font-size:12px;color:var(--text-tertiary)">${esc(entry.path)}${entry.startLine ? ':' + entry.startLine : ''}</div>
          </div>
        </div>
      `).join('')
    : `<div class="form-hint">${esc(t('dreaming.noEntries'))}</div>`
  return `
    <div class="config-section" style="margin:0;border:1px solid ${tone.border};background:${tone.bg};backdrop-filter:blur(6px)">
      <div class="config-section-title">${esc(title)}</div>
      <div class="form-hint" style="margin-bottom:8px">${esc(subtitle)}</div>
      ${items}
    </div>
  `
}

function renderSceneView(status, enabled, heroText, disabledAttr, nextRun) {
  const stars = [
    { top: '14%', left: '8%', size: 4, opacity: 0.8 },
    { top: '22%', left: '30%', size: 6, opacity: 0.55 },
    { top: '18%', left: '64%', size: 5, opacity: 0.75 },
    { top: '32%', left: '74%', size: 3, opacity: 0.9 },
    { top: '58%', left: '18%', size: 5, opacity: 0.65 },
    { top: '66%', left: '54%', size: 4, opacity: 0.7 },
    { top: '72%', left: '82%', size: 6, opacity: 0.5 },
  ]
  return `
    <div style="position:relative;overflow:hidden;border-radius:22px;padding:24px;background:radial-gradient(circle at 20% 10%, rgba(139,92,246,0.42), rgba(15,23,42,0.94) 52%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%);color:#e2e8f0;box-shadow:0 24px 64px rgba(15,23,42,0.35);margin-bottom:var(--space-lg)">
      ${stars.map((star) => `<div style="position:absolute;top:${star.top};left:${star.left};width:${star.size}px;height:${star.size}px;border-radius:999px;background:rgba(255,255,255,${star.opacity});box-shadow:0 0 16px rgba(255,255,255,0.28)"></div>`).join('')}
      <div style="position:absolute;top:22px;right:28px;width:118px;height:118px;border-radius:999px;background:radial-gradient(circle at 35% 35%, rgba(255,255,255,0.98), rgba(224,231,255,0.92) 38%, rgba(196,181,253,0.56) 62%, rgba(99,102,241,0.16) 100%);box-shadow:0 0 32px rgba(196,181,253,0.45), 0 0 88px rgba(99,102,241,0.18)"></div>
      <div style="position:relative;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap">
        <div style="max-width:620px">
          <div class="badge${enabled ? ' badge-success' : ''}" style="margin-bottom:10px">${esc(enabled ? t('dreaming.statusEnabled') : t('dreaming.statusDisabled'))}</div>
          <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;margin-bottom:10px">${esc(t('dreaming.sceneTitle'))}</div>
          <div style="font-size:14px;line-height:1.8;color:rgba(226,232,240,0.88);max-width:560px">${esc(t('dreaming.sceneDesc'))}</div>
          <div style="margin-top:12px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.92)">${esc(heroText)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <div style="padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:12px">${esc(`${t('dreaming.nextRun')}: ${nextRun}`)}</div>
            <div style="padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:12px">${esc(`${t('dreaming.timezone')}: ${status?.timezone || '—'}`)}</div>
            <div style="padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:12px">${esc(`${t('dreaming.memoryPath')}: ${status?.storePath || 'MEMORY.md'}`)}</div>
          </div>
        </div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;gap:10px;align-items:flex-end;max-width:420px">
          ${renderActionButtons(enabled, disabledAttr)}
        </div>
      </div>
      ${renderStatusHints()}
      <div style="position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px">
        <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.08);backdrop-filter:blur(8px)"><div style="font-size:12px;color:rgba(226,232,240,0.72)">${esc(t('dreaming.sceneConstellation'))}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${esc(status?.shortTermCount ?? 0)}</div></div>
        <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.08);backdrop-filter:blur(8px)"><div style="font-size:12px;color:rgba(226,232,240,0.72)">${esc(t('dreaming.sceneSignals'))}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${esc(status?.totalSignalCount ?? 0)}</div></div>
        <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.08);backdrop-filter:blur(8px)"><div style="font-size:12px;color:rgba(226,232,240,0.72)">${esc(t('dreaming.scenePromotions'))}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${esc(status?.promotedTotal ?? 0)}</div></div>
        <div style="padding:14px;border-radius:16px;background:rgba(255,255,255,0.08);backdrop-filter:blur(8px)"><div style="font-size:12px;color:rgba(226,232,240,0.72)">${esc(t('dreaming.sceneQueue'))}</div><div style="font-size:24px;font-weight:700;margin-top:4px">${esc((status?.shortTermEntries || []).length)}</div></div>
      </div>
    </div>

    <div class="stat-cards" style="margin-bottom:var(--space-lg)">
      ${renderStatCard(t('dreaming.nextRun'), nextRun)}
      ${renderStatCard(t('dreaming.timezone'), status?.timezone || '—')}
      ${renderStatCard(t('dreaming.storageMode'), status?.storageMode || 'inline')}
      ${renderStatCard(t('dreaming.promotedToday'), status?.promotedToday ?? 0)}
      ${renderStatCard(t('dreaming.promotedTotal'), status?.promotedTotal ?? 0)}
      ${renderStatCard(t('dreaming.shortTerm'), status?.shortTermCount ?? 0, `${t('dreaming.memoryPath')}: ${status?.storePath || 'MEMORY.md'}`)}
      ${renderStatCard(t('dreaming.grounded'), status?.groundedSignalCount ?? 0)}
      ${renderStatCard(t('dreaming.signals'), status?.totalSignalCount ?? 0, `${t('dreaming.diaryPath')}: ${_state.diaryPath || 'DREAMS.md'}`)}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-md);margin-bottom:var(--space-lg)">
      ${renderPhaseCard(t('dreaming.phaseLight'), status?.phases?.light || normalizePhase(null))}
      ${renderPhaseCard(t('dreaming.phaseDeep'), status?.phases?.deep || normalizePhase(null))}
      ${renderPhaseCard(t('dreaming.phaseRem'), status?.phases?.rem || normalizePhase(null))}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-md)">
      ${renderDreamLane(t('dreaming.sceneQueue'), t('dreaming.entriesShortTerm'), status?.shortTermEntries || [], 'violet')}
      ${renderDreamLane(t('dreaming.sceneSignals'), t('dreaming.entriesSignals'), status?.signalEntries || [], 'cyan')}
      ${renderDreamLane(t('dreaming.scenePromotions'), t('dreaming.entriesPromoted'), status?.promotedEntries || [], 'amber')}
    </div>
  `
}

function renderDiaryView(status, enabled, heroText, disabledAttr) {
  const sections = parseDiarySections(_state.diaryContent)
  return `
    <div class="config-section" style="margin-bottom:var(--space-lg);background:linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.02));border:1px solid rgba(99,102,241,0.14)">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div style="max-width:620px">
          <div class="config-section-title">${esc(t('dreaming.diary'))}</div>
          <div style="font-size:14px;line-height:1.8;color:var(--text-secondary)">${esc(heroText)}</div>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
            <div class="badge${enabled ? ' badge-success' : ''}">${esc(enabled ? t('dreaming.statusEnabled') : t('dreaming.statusDisabled'))}</div>
            <div class="badge">${esc(`${t('dreaming.diaryPath')}: ${_state.diaryPath || 'DREAMS.md'}`)}</div>
            <div class="badge">${esc(`${t('dreaming.diarySections')}: ${sections.length}`)}</div>
          </div>
        </div>
        ${renderActionButtons(enabled, disabledAttr)}
      </div>
      ${renderStatusHints()}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--space-md)">
      <div class="config-section" style="margin:0">
        <div class="config-section-title">${esc(t('dreaming.diarySections'))}</div>
        ${sections.length
          ? sections.map((section, idx) => `
              <div style="padding:14px 0;border-bottom:${idx === sections.length - 1 ? 'none' : '1px solid var(--border-primary)'}">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                  <span class="badge${idx === 0 ? ' badge-success' : ''}">${esc(`${t('dreaming.diarySection')} ${idx + 1}`)}</span>
                  <span style="font-weight:600;color:var(--text-primary)">${esc(section.title)}</span>
                </div>
                <div style="font-size:13px;line-height:1.7;color:var(--text-secondary)">${esc(section.body.slice(0, 220) || section.title)}</div>
              </div>
            `).join('')
          : `<div class="form-hint" style="line-height:1.8">${esc(t('dreaming.diaryEmpty'))}<br>${esc(t('dreaming.diaryEmptyHint'))}</div>`}
      </div>

      <div class="config-section" style="margin:0">
        <div class="config-section-title">${esc(t('dreaming.diaryRaw'))}</div>
        ${typeof _state.diaryContent === 'string'
          ? `<pre style="white-space:pre-wrap;word-break:break-word;background:var(--bg-secondary);border-radius:var(--radius);padding:var(--space-md);font-size:12px;line-height:1.7;max-height:560px;overflow:auto">${esc(_state.diaryContent)}</pre>`
          : `<div class="form-hint" style="line-height:1.8">${esc(t('dreaming.diaryEmpty'))}<br>${esc(t('dreaming.diaryEmptyHint'))}</div>`}
      </div>
    </div>
  `
}

function bindEvents(page) {
  page.querySelectorAll('[data-dreaming-view]').forEach((tab) => {
    tab.addEventListener('click', () => {
      _state.view = tab.dataset.dreamingView || 'scene'
      renderPage(page)
    })
  })
  page.querySelector('#btn-dreaming-refresh')?.addEventListener('click', () => loadAll(page))
  page.querySelector('#btn-dreaming-open-memory')?.addEventListener('click', () => navigate('/memory'))
  page.querySelector('#btn-dreaming-toggle')?.addEventListener('click', () => toggleDreaming())
  page.querySelector('#btn-dreaming-backfill')?.addEventListener('click', () => runAction('doctor.memory.backfillDreamDiary', t('dreaming.backfillDone')))
  page.querySelector('#btn-dreaming-reset-diary')?.addEventListener('click', async () => {
    const yes = await showConfirm(t('dreaming.confirmResetDiary'))
    if (!yes) return
    runAction('doctor.memory.resetDreamDiary', t('dreaming.resetDiaryDone'))
  })
  page.querySelector('#btn-dreaming-clear-grounded')?.addEventListener('click', async () => {
    const yes = await showConfirm(t('dreaming.confirmClearGrounded'))
    if (!yes) return
    runAction('doctor.memory.resetGroundedShortTerm', t('dreaming.clearGroundedDone'))
  })
}

function renderPage(page) {
  const status = _state.status
  const ready = wsClient.connected && wsClient.gatewayReady
  const enabled = status?.enabled === true
  const nextRun = formatNextRun(resolveNextRun(status))
  const heroText = enabled ? t('dreaming.heroActive') : t('dreaming.heroIdle')
  const disabledAttr = _state.actionLoading || !ready ? 'disabled' : ''

  let body = ''

  if (_state.loading) {
    body = `
      <div class="stat-card loading-placeholder" style="height:120px"></div>
      <div class="stat-card loading-placeholder" style="height:220px;margin-top:var(--space-md)"></div>
    `
  } else if (!ready) {
    body = `
      <div class="config-section">
        <div style="color:var(--text-tertiary);margin-bottom:8px">${esc(t('dreaming.gwConnecting'))}</div>
        <div class="form-hint">${esc(t('dreaming.gwWait'))}</div>
      </div>
    `
  } else if (_state.unsupported) {
    body = `
      <div class="config-section" style="border-left:3px solid var(--warning)">
        <div class="config-section-title">${esc(t('dreaming.loadFailed'))}</div>
        <div style="color:var(--warning);line-height:1.7">${esc(_state.error || t('dreaming.unsupportedHint'))}</div>
        <div class="form-hint" style="margin-top:8px">${esc(t('dreaming.loadFailedHint'))}</div>
      </div>
    `
  } else {
    body = renderViewTabs() + (_state.view === 'diary'
      ? renderDiaryView(status, enabled, heroText, disabledAttr)
      : renderSceneView(status, enabled, heroText, disabledAttr, nextRun))
  }

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${t('dreaming.title')}</h1>
      <p class="page-desc">${t('dreaming.desc')}</p>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" id="btn-dreaming-refresh">${icon('refresh-cw', 14)} ${t('dreaming.refresh')}</button>
        <button class="btn btn-sm btn-secondary" id="btn-dreaming-open-memory">${t('dreaming.openMemory')}</button>
      </div>
    </div>
    ${body}
  `

  bindEvents(page)
}
