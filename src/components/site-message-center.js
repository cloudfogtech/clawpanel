import { t } from '../lib/i18n.js'

const ICON_BELL = '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>'
const ICON_SEND = '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>'
const DISMISS_PREFIX = 'clawpanel_announcement_dismissed_'
const TODAY_CLOSE_KEY = 'clawpanel_site_message_closed_today'
const LAUNCHER_SELECTOR = '.site-message-trigger'

let _fetcher = null
let _overlay = null
let _messages = { notifications: [], announcements: [] }
let _activeTab = 'notifications'
let _launcherBound = false

export function initSiteMessageCenter({ fetcher } = {}) {
  _fetcher = typeof fetcher === 'function' ? fetcher : null
  bindLaunchers()
  updateLauncherBadge()

  window.addEventListener('clawpanel:site-message-launcher-mounted', updateLauncherBadge)
  window.addEventListener('clawpanel:show-site-messages', async (event) => {
    const detail = event.detail || {}
    const payload = detail.payload || (detail.notifications || detail.announcements ? detail : null)
    if (payload && typeof payload === 'object' && (payload.notifications || payload.announcements)) {
      setSiteMessageCenterPayload(payload)
      openSiteMessageCenter({ force: true, tab: detail.tab })
      return
    }
    if (detail.tab) {
      openSiteMessageCenter({ force: true, tab: detail.tab })
      return
    }
    await refreshSiteMessageCenter({ auto: false, forceOpen: true })
  })
}

export async function refreshSiteMessageCenter({ auto = false, forceOpen = false, tab = null } = {}) {
  if (!_fetcher) return
  try {
    const payload = await _fetcher()
    setSiteMessageCenterPayload(payload)
    if (forceOpen) {
      openSiteMessageCenter({ force: true, tab })
    } else if (auto && shouldAutoOpen()) {
      openSiteMessageCenter({ tab })
    }
  } catch {
    if (forceOpen) openSiteMessageCenter({ force: true, tab })
  }
}

export function setSiteMessageCenterPayload(payload) {
  _messages = normalizePayload(payload)
  if (!_messages[_activeTab]?.length) {
    _activeTab = _messages.notifications.length ? 'notifications' : 'announcements'
  }
  updateLauncherBadge()
}

export function normalizeSiteMessagePayload(payload = {}) {
  return normalizePayload(payload)
}

export function openSiteMessageCenter({ force = false, tab = null } = {}) {
  const visible = getVisibleMessages()
  if (!force && !visible.notifications.length && !visible.announcements.length) return
  _activeTab = tab || getPreferredTab()
  renderModal()
}

function bindLaunchers() {
  if (_launcherBound) return
  _launcherBound = true
  document.addEventListener('click', (event) => {
    const btn = event.target.closest(LAUNCHER_SELECTOR)
    if (!btn) return
    event.preventDefault()
    refreshSiteMessageCenter({ forceOpen: true }).catch(() => openSiteMessageCenter({ force: true }))
  })
}

function updateLauncherBadge() {
  const visible = getVisibleMessages()
  const count = isClosedToday() ? 0 : visible.notifications.length + visible.announcements.length
  document.querySelectorAll(LAUNCHER_SELECTOR).forEach((launcher) => {
    launcher.classList.toggle('has-unread', count > 0)
    launcher.classList.toggle('is-muted-today', isClosedToday())
    const badge = launcher.querySelector('.site-message-tool-badge, .site-message-fab-badge')
    if (badge) badge.textContent = count > 9 ? '9+' : String(count || '')
  })
}

function renderModal() {
  const old = document.getElementById('site-message-overlay')
  if (old) old.remove()

  const visible = getVisibleMessages()
  const dismissed = getDismissedMessages()
  const displayCounts = {
    notifications: visible.notifications.length + dismissed.notifications.length,
    announcements: visible.announcements.length + dismissed.announcements.length,
  }
  const activeVisibleCount = visible[_activeTab]?.length || 0

  const overlay = document.createElement('div')
  overlay.id = 'site-message-overlay'
  overlay.className = 'site-message-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `
    <section class="site-message-modal" tabindex="-1">
      <header class="site-message-header">
        <div class="site-message-title">
          <span class="site-message-title-icon" aria-hidden="true">${ICON_BELL}</span>
          <div>
            <h2>${t('siteMessages.title')}</h2>
            <p>${formatSummary(displayCounts)}</p>
          </div>
        </div>
        <div class="site-message-tabs" role="tablist">
          ${renderTab('notifications', t('siteMessages.notifications'), ICON_BELL, displayCounts.notifications)}
          ${renderTab('announcements', t('siteMessages.announcements'), ICON_SEND, displayCounts.announcements)}
        </div>
        <button class="site-message-close" type="button" title="${t('common.close')}">${ICON_X}</button>
      </header>
      <div class="site-message-body">
        ${_activeTab === 'notifications'
          ? renderNotifications(visible.notifications, dismissed.notifications)
          : renderAnnouncements(visible.announcements, dismissed.announcements)}
      </div>
      <footer class="site-message-footer">
        <button class="btn btn-secondary btn-sm" type="button" data-site-message-today>${t('siteMessages.closeToday')}</button>
        ${activeVisibleCount
          ? `<button class="btn btn-primary btn-sm" type="button" data-site-message-dismiss>${getDismissButtonLabel()}</button>`
          : `<button class="btn btn-primary btn-sm" type="button" data-site-message-close-current>${t('common.close')}</button>`}
      </footer>
    </section>
  `

  document.body.appendChild(overlay)
  _overlay = overlay
  bindModalEvents(overlay)
  const modal = overlay.querySelector('.site-message-modal')
  modal?.focus({ preventScroll: true })
}

function renderTab(tab, label, icon, count) {
  const active = _activeTab === tab
  return `
    <button class="site-message-tab ${active ? 'active' : ''}" type="button" role="tab" aria-selected="${active}" data-site-message-tab="${tab}">
      ${icon}<span>${label}</span>${count ? `<small>${count}</small>` : ''}
    </button>
  `
}

function renderNotifications(items, dismissedItems = []) {
  if (!items.length) {
    if (dismissedItems.length) return renderDismissedState('notifications', dismissedItems.length)
    return `
      <div class="site-message-empty">
        <span class="site-message-empty-icon" aria-hidden="true">${ICON_BELL}</span>
        <strong>${t('siteMessages.emptyNotifications')}</strong>
        <p>${t('siteMessages.emptyNotificationsHint')}</p>
      </div>
    `
  }
  return `
    <div class="site-message-section-head">
      <span>${t('siteMessages.notificationFeed')}</span>
      <small>${t('siteMessages.sortedByTime')}</small>
    </div>
    <div class="site-message-timeline">
      ${items.map(item => `
        <article class="site-message-timeline-item level-${escapeAttr(item.level)}">
          <div class="site-message-dot" aria-hidden="true"></div>
          <div class="site-message-line" aria-hidden="true"></div>
          <div class="site-message-timeline-content">
            <div class="site-message-item-top">
              <h3>${escapeHtml(item.title)}</h3>
              <span>${renderLevelLabel(item.level)}</span>
            </div>
            ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}
            <div class="site-message-meta">${formatMessageTime(item)}</div>
            ${renderMessageCta(item)}
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderAnnouncements(items, dismissedItems = []) {
  if (!items.length) {
    if (dismissedItems.length) return renderDismissedState('announcements', dismissedItems.length)
    return `
      <div class="site-message-empty">
        <span class="site-message-empty-icon" aria-hidden="true">${ICON_SEND}</span>
        <strong>${t('siteMessages.emptyAnnouncements')}</strong>
        <p>${t('siteMessages.emptyAnnouncementsHint')}</p>
      </div>
    `
  }
  return `
    <div class="site-message-section-head">
      <span>${t('siteMessages.fixedAnnouncements')}</span>
      <small>${t('siteMessages.managedBySite')}</small>
    </div>
    <div class="site-message-announcement-list">
      ${items.map((item, index) => `
        <article class="site-message-announcement level-${escapeAttr(item.level)} ${index === 0 ? 'featured' : ''}">
          <div class="site-message-announcement-main">
            <div class="site-message-announcement-kicker">
              <span>${escapeHtml(item.badge || t('siteMessages.announcementBadge'))}</span>
              <small>${renderLevelLabel(item.level)}</small>
            </div>
            <h3>${escapeHtml(item.title)}</h3>
            ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ''}
          </div>
          <div class="site-message-announcement-side">
            <span>${formatMessageTime(item)}</span>
            ${renderMessageCta(item, true)}
          </div>
        </article>
      `).join('')}
    </div>
  `
}

function renderDismissedState(tab, count) {
  const icon = tab === 'notifications' ? ICON_BELL : ICON_SEND
  return `
    <div class="site-message-empty site-message-dismissed-empty">
      <span class="site-message-empty-icon" aria-hidden="true">${icon}</span>
      <strong>${t('siteMessages.dismissedTitle')}</strong>
      <p>${t('siteMessages.dismissedHint', { count })}</p>
      <button class="btn btn-secondary btn-sm" type="button" data-site-message-restore>${t('siteMessages.restoreDismissed')}</button>
    </div>
  `
}

function renderMessageCta(item, prominent = false) {
  if (!item.ctaText || !item.ctaUrl) return ''
  return `<a class="${prominent ? 'site-message-card-cta' : 'site-message-inline-cta'}" href="${escapeAttr(item.ctaUrl)}" target="_blank" rel="noopener">${escapeHtml(item.ctaText)}</a>`
}

function bindModalEvents(overlay) {
  overlay.querySelector('.site-message-close')?.addEventListener('click', closeModal)
  overlay.querySelector('[data-site-message-today]')?.addEventListener('click', () => {
    localStorage.setItem(TODAY_CLOSE_KEY, todayKey())
    closeModal()
    updateLauncherBadge()
  })
  overlay.querySelector('[data-site-message-dismiss]')?.addEventListener('click', () => {
    dismissItems(getVisibleMessages()[_activeTab])
    closeModal()
    updateLauncherBadge()
  })
  overlay.querySelector('[data-site-message-close-current]')?.addEventListener('click', closeModal)
  overlay.querySelector('[data-site-message-restore]')?.addEventListener('click', () => {
    restoreItems(_messages[_activeTab])
    renderModal()
    updateLauncherBadge()
  })
  overlay.querySelectorAll('[data-site-message-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.siteMessageTab || 'notifications'
      renderModal()
    })
  })
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal()
  })
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal()
  })
}

function closeModal() {
  _overlay?.remove()
  _overlay = null
}

function dismissItems(items) {
  for (const item of items || []) {
    const key = dismissStorageKey(item)
    if (key) localStorage.setItem(key, '1')
  }
}

function restoreItems(items) {
  for (const item of items || []) {
    const key = dismissStorageKey(item)
    if (key) localStorage.removeItem(key)
  }
}

function shouldAutoOpen() {
  if (isClosedToday()) return false
  const visible = getVisibleMessages()
  return visible.notifications.length > 0 || visible.announcements.length > 0
}

function isClosedToday() {
  return localStorage.getItem(TODAY_CLOSE_KEY) === todayKey()
}

function getVisibleMessages() {
  return {
    notifications: _messages.notifications.filter(item => !isDismissed(item)),
    announcements: _messages.announcements.filter(item => !isDismissed(item)),
  }
}

function getDismissedMessages() {
  return {
    notifications: _messages.notifications.filter(isDismissed),
    announcements: _messages.announcements.filter(isDismissed),
  }
}

function getPreferredTab() {
  const visible = getVisibleMessages()
  if (visible.notifications.length) return 'notifications'
  if (visible.announcements.length) return 'announcements'
  const dismissed = getDismissedMessages()
  if (dismissed.notifications.length) return 'notifications'
  return 'announcements'
}

function getDismissButtonLabel() {
  if (_activeTab === 'notifications') return t('siteMessages.dismissCurrentNotifications')
  return t('siteMessages.dismissCurrentAnnouncements')
}

function normalizePayload(payload = {}) {
  const notifications = []
  const announcements = []

  const appendItem = (raw, fallbackType) => {
    if (!acceptsClientSurface(raw)) return
    const displayType = classifyDisplayType(raw, fallbackType)
    const item = normalizeItem(raw, displayType)
    if (displayType === 'notification') {
      notifications.push(item)
    } else {
      announcements.push(item)
    }
  }

  if (Array.isArray(payload.notifications)) {
    payload.notifications.forEach(item => appendItem(item, 'notification'))
  }
  if (Array.isArray(payload.announcements)) {
    payload.announcements.forEach(item => appendItem(item, 'announcement'))
  }

  notifications.sort(sortByTimeDesc)
  announcements.sort(sortByPriority)
  return { notifications, announcements }
}

function normalizeItem(item = {}, fallbackType = 'notification') {
  const displayType = classifyDisplayType(item, fallbackType)
  const type = String(item.type || item.kind || item.category || displayType).toLowerCase()
  const level = normalizeLevel(item.level)
  return {
    id: String(item.id || item.dismissKey || `${type}-${item.title || item.updatedAt || Date.now()}`),
    type,
    displayType,
    targetSurface: String(item.targetSurface || item.surface || ''),
    level,
    title: String(item.title || t('siteMessages.defaultTitle')),
    body: String(item.body || item.content || item.summary || ''),
    badge: item.badge ? String(item.badge) : '',
    ctaText: item.ctaText ? String(item.ctaText) : '',
    ctaUrl: item.ctaUrl ? safeHref(item.ctaUrl) : '',
    dismissKey: item.dismissKey || item.id || '',
    updatedAt: item.updatedAt || item.publishedAt || item.startAt || item.createdAt || '',
    pinned: item.pinned === true || item.fixed === true || displayType === 'announcement',
  }
}

function acceptsClientSurface(item = {}) {
  const surface = String(item.targetSurface || item.surface || '').trim().toLowerCase()
  return !surface || surface === 'client' || surface === 'all'
}

function classifyDisplayType(item = {}, fallbackType = 'notification') {
  const raw = String(item.displayType || item.display_type || item.type || item.kind || item.category || fallbackType)
    .trim()
    .toLowerCase()
  if (['notification', 'notice', 'message', 'feed', 'timeline'].includes(raw)) return 'notification'
  return 'announcement'
}

function normalizeLevel(level) {
  const next = String(level || 'info').toLowerCase()
  return ['critical', 'warning', 'success', 'info'].includes(next) ? next : 'info'
}

function sortByTimeDesc(a, b) {
  return toTime(b.updatedAt) - toTime(a.updatedAt)
}

function sortByPriority(a, b) {
  const weight = { critical: 3, warning: 2, success: 1, info: 0 }
  return (weight[b.level] || 0) - (weight[a.level] || 0) || sortByTimeDesc(a, b)
}

function formatMessageTime(item) {
  const time = toTime(item.updatedAt)
  if (!time) return t('siteMessages.timeUnknown')
  const date = new Date(time)
  const now = Date.now()
  const diffDays = Math.floor((now - time) / 86400000)
  const absolute = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (diffDays <= 0) return `${t('siteMessages.today')} ${absolute}`
  if (diffDays < 30) return `${diffDays}${t('siteMessages.daysAgo')} ${absolute}`
  const months = Math.max(1, Math.floor(diffDays / 30))
  return `${months}${t('siteMessages.monthsAgo')} ${absolute}`
}

function formatSummary(visible) {
  return t('siteMessages.summary', {
    notifications: visible.notifications.length,
    announcements: visible.announcements.length,
  })
}

function renderLevelLabel(level) {
  const labels = {
    critical: t('siteMessages.levelCritical'),
    warning: t('siteMessages.levelWarning'),
    success: t('siteMessages.levelSuccess'),
    info: t('siteMessages.levelInfo'),
  }
  return labels[level] || labels.info
}

function dismissStorageKey(item) {
  const key = item?.dismissKey || item?.id
  return key ? `${DISMISS_PREFIX}${key}` : ''
}

function isDismissed(item) {
  const key = dismissStorageKey(item)
  return !!key && localStorage.getItem(key) === '1'
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function toTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function safeHref(raw) {
  try {
    const url = new URL(String(raw || '').trim())
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      return url.toString()
    }
  } catch {}
  return ''
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
