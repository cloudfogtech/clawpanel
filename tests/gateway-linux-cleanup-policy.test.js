import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('../src-tauri/src/commands/service.rs', import.meta.url), 'utf8')

test('Linux Gateway cleanup verifies process identity before killing listeners', () => {
  const linuxStart = service.indexOf('#[cfg(target_os = "linux")]')
  const fallbackStart = service.indexOf('#[cfg(target_os = "windows")]\npub fn invalidate_cli_detection_cache', linuxStart)
  const linux = linuxStart >= 0 && fallbackStart > linuxStart
    ? service.slice(linuxStart, fallbackStart)
    : ''
  const cleanupStart = linux.indexOf('fn cleanup_zombie_gateway_processes()')
  const cleanupEnd = linux.indexOf('async fn gateway_command', cleanupStart)
  const cleanup = cleanupStart >= 0 && cleanupEnd > cleanupStart
    ? linux.slice(cleanupStart, cleanupEnd)
    : ''

  assert.ok(cleanup, 'Linux cleanup function must exist')
  assert.doesNotMatch(cleanup, /Command::new\("fuser"\)/)
  assert.match(cleanup, /read_process_command_line\(pid\)/)
  assert.match(cleanup, /is_gateway_command_line\(&cmdline\)/)
  assert.match(cleanup, /is_gateway_port_responsive_with_retry/)
  assert.match(cleanup, /Command::new\("kill"\)/)
})
