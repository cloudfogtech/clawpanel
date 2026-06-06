import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const devApi = readFileSync(new URL('../scripts/dev-api.js', import.meta.url), 'utf8')
const rustConfig = readFileSync(new URL('../src-tauri/src/commands/config.rs', import.meta.url), 'utf8')

test('ClawPanel 版本发现只使用官网 API，不再回退 GitHub/Gitee release API', () => {
  for (const source of [devApi, rustConfig]) {
    assert.doesNotMatch(
      source,
      /api\.github\.com\/repos\/qingchencloud\/clawpanel\/releases\/latest/,
      '版本发现不应再请求 GitHub releases latest API',
    )
    assert.doesNotMatch(
      source,
      /gitee\.com\/api\/v5\/repos\/QtCodeCreators\/clawpanel\/releases\/latest/,
      '版本发现不应再请求 Gitee releases latest API',
    )
  }

  assert.match(devApi, /return await getSitePanelUpdate\(\)/)
  assert.match(rustConfig, /site_latest_for_panel_update\(\)/)
})
