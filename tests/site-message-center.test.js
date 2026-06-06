import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSiteMessagePayload } from '../src/components/site-message-center.js'

test('官网公告接口按 displayType 分流并过滤非客户端 surface', () => {
  const normalized = normalizeSiteMessagePayload({
    announcements: [
      {
        id: 1,
        displayType: 'notification',
        targetSurface: 'client',
        level: 'success',
        title: '客户端通知',
        body: '通知正文',
        dismissKey: 'client-notification',
        updatedAt: '2026-06-06T03:21:10Z',
      },
      {
        id: 2,
        displayType: 'announcement',
        targetSurface: 'all',
        level: 'warning',
        title: '系统公告',
        body: '公告正文',
        dismissKey: 'system-announcement',
        updatedAt: '2026-06-06T03:22:10Z',
      },
      {
        id: 3,
        displayType: 'notification',
        targetSurface: 'home',
        title: '官网首页通知',
      },
    ],
  })

  assert.equal(normalized.notifications.length, 1)
  assert.equal(normalized.announcements.length, 1)
  assert.equal(normalized.notifications[0].title, '客户端通知')
  assert.equal(normalized.announcements[0].title, '系统公告')
})

test('官网公告接口兼容 modal/notification 类型', () => {
  const normalized = normalizeSiteMessagePayload({
    announcements: [
      {
        id: 4,
        type: 'modal',
        displayType: 'modal',
        targetSurface: 'client',
        level: 'warning',
        title: '客户端弹窗测试',
        body: '客户端弹窗测试',
        dismissKey: 'client-modal-202606',
        updatedAt: '2026-06-06T07:25:40Z',
      },
      {
        id: 3,
        type: 'notification',
        displayType: 'notification',
        targetSurface: 'client',
        level: 'info',
        title: '客户端通知测试',
        body: '客户端通知测试',
        dismissKey: 'client-notification-202606',
        updatedAt: '2026-06-06T07:25:28Z',
      },
    ],
  })

  assert.equal(normalized.notifications.length, 1)
  assert.equal(normalized.announcements.length, 1)
  assert.equal(normalized.notifications[0].title, '客户端通知测试')
  assert.equal(normalized.announcements[0].title, '客户端弹窗测试')
})
