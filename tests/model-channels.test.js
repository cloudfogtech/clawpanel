import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')

const lib = read('../src/lib/model-channels.js')
const page = read('../src/pages/model-channels.js')
const mainJs = read('../src/main.js')
const sidebar = read('../src/components/sidebar.js')
const tauriApi = read('../src/lib/tauri-api.js')
const devApi = read('../scripts/dev-api.js')
const rustLib = read('../src-tauri/src/lib.rs')
const rustModule = read('../src-tauri/src/commands/model_channels.rs')
const localesIndex = read('../src/locales/index.js')

test('模型渠道命令注册链完整（Rust + tauri-api + dev-api + ALWAYS_LOCAL）', () => {
  for (const cmd of ['read_model_channels', 'write_model_channels', 'reveal_model_channel_key']) {
    assert.match(rustLib, new RegExp(`model_channels::${cmd}`), `lib.rs 缺少 ${cmd} 注册`)
    assert.match(devApi, new RegExp(`${cmd}\\(`), `dev-api.js 缺少 ${cmd} handler`)
    assert.match(devApi, new RegExp(`'${cmd}'`), `${cmd} 必须加入 ALWAYS_LOCAL（本机属性不可代理远程）`)
  }
  assert.match(tauriApi, /readModelChannels:/, 'tauri-api 缺少 readModelChannels 封装')
  assert.match(tauriApi, /writeModelChannels:/, 'tauri-api 缺少 writeModelChannels 封装')
  assert.match(tauriApi, /revealModelChannelKey:/, 'tauri-api 缺少 revealModelChannelKey 封装')
})

test('渠道读取只返回掩码，写入支持保留旧 Key 哨兵', () => {
  assert.match(rustModule, /apiKeySaved/, '读取必须返回 apiKeySaved')
  assert.match(rustModule, /apiKeyMask/, '读取必须返回 apiKeyMask')
  assert.match(rustModule, /__KEEP__/, '写入必须支持 __KEEP__ 哨兵')
  assert.match(devApi, /isChannelKeepSentinel/, 'dev-api 必须实现相同的哨兵语义')
})

test('Hermes 同步仅覆盖 API Key 型三类 transport', () => {
  assert.match(lib, /'openai-completions':\s*\{\s*transport:\s*'openai_chat'/, 'openai transport 映射缺失')
  assert.match(lib, /'anthropic-messages':\s*\{\s*transport:\s*'anthropic_messages'/, 'anthropic transport 映射缺失')
  assert.match(lib, /'google-generative-ai':\s*\{\s*transport:\s*'google_gemini'/, 'gemini transport 映射缺失')
  assert.match(lib, /authType === 'api_key'/, 'OAuth/SDK 型 provider 必须被排除在渠道同步之外')
})

test('OpenClaw 同步只 upsert 单个 provider 并保留未知字段', () => {
  assert.match(lib, /\.\.\.existing,/, '写入 provider 时必须展开旧对象保留未知字段')
  assert.match(lib, /config\.models\.providers\[providerKey\]/, '必须按 provider 键 upsert 而非整体重写')
})

test('同步与删除必须经过确认弹窗', () => {
  assert.match(page, /showConfirm\(t\('modelChannels\.syncOpenclawConfirm'/, '同步 OpenClaw 前必须确认')
  assert.match(page, /showConfirm\(t\('modelChannels\.syncHermesConfirm'/, '同步 Hermes 前必须确认')
  assert.match(page, /showConfirm\(t\('modelChannels\.syncAssistantConfirm'/, '同步助手前必须确认')
  assert.match(page, /showConfirm\(t\('modelChannels\.deleteConfirm'/, '删除渠道前必须确认')
})

test('页面注册链完整（路由 + 侧栏 + 语言包）', () => {
  assert.match(mainJs, /registerRoute\('\/model-channels'/, 'main.js 缺少路由注册')
  assert.match(sidebar, /route: '\/model-channels'/, '侧栏缺少入口')
  assert.match(sidebar, /'channels-hub':/, '侧栏缺少图标')
  assert.match(localesIndex, /modelChannels/, '语言包聚合缺少 modelChannels 模块')
})
