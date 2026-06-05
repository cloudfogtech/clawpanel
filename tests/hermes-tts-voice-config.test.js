import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHermesTtsVoiceConfigValues,
  mergeHermesTtsVoiceConfig,
} from '../scripts/dev-api.js'

test('Hermes TTS/Voice 配置读取会提供上游默认值', () => {
  const values = buildHermesTtsVoiceConfigValues({})

  assert.deepEqual(values, {
    ttsProvider: 'edge',
    ttsEdgeVoice: 'en-US-AriaNeural',
    ttsOpenaiModel: 'gpt-4o-mini-tts',
    ttsOpenaiVoice: 'alloy',
    ttsElevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    ttsElevenlabsModelId: 'eleven_multilingual_v2',
    ttsXaiVoiceId: 'eve',
    ttsXaiLanguage: 'en',
    ttsXaiSampleRate: 24000,
    ttsXaiBitRate: 128000,
    ttsMistralModel: 'voxtral-mini-tts-2603',
    ttsMistralVoiceId: 'c69964a6-ab8b-4f8a-9465-ec0925096ec8',
    ttsPiperVoice: 'en_US-lessac-medium',
    voiceRecordKey: 'ctrl+b',
    voiceMaxRecordingSeconds: 120,
    voiceAutoTts: false,
    voiceBeepEnabled: true,
    voiceSilenceThreshold: 200,
    voiceSilenceDuration: 3,
  })
})

test('Hermes TTS/Voice 配置读取会回显 YAML 字段', () => {
  const values = buildHermesTtsVoiceConfigValues({
    tts: {
      provider: 'openai',
      edge: { voice: 'zh-CN-XiaoxiaoNeural' },
      openai: { model: 'gpt-4o-mini-tts', voice: 'nova' },
      elevenlabs: { voice_id: 'voice-123', model_id: 'eleven_turbo_v2_5' },
      xai: {
        voice_id: 'custom-eve',
        language: 'zh',
        sample_rate: 48000,
        bit_rate: 192000,
      },
      mistral: { model: 'voxtral-mini-tts-2603', voice_id: 'mistral-voice' },
      piper: { voice: 'zh_CN-huayan-medium' },
    },
    voice: {
      record_key: 'ctrl+shift+v',
      max_recording_seconds: 240,
      auto_tts: true,
      beep_enabled: false,
      silence_threshold: 350,
      silence_duration: 1.5,
    },
  })

  assert.equal(values.ttsProvider, 'openai')
  assert.equal(values.ttsEdgeVoice, 'zh-CN-XiaoxiaoNeural')
  assert.equal(values.ttsOpenaiVoice, 'nova')
  assert.equal(values.ttsElevenlabsVoiceId, 'voice-123')
  assert.equal(values.ttsXaiLanguage, 'zh')
  assert.equal(values.ttsXaiSampleRate, 48000)
  assert.equal(values.ttsMistralVoiceId, 'mistral-voice')
  assert.equal(values.ttsPiperVoice, 'zh_CN-huayan-medium')
  assert.equal(values.voiceRecordKey, 'ctrl+shift+v')
  assert.equal(values.voiceAutoTts, true)
  assert.equal(values.voiceBeepEnabled, false)
  assert.equal(values.voiceSilenceDuration, 1.5)
})

test('Hermes TTS/Voice 配置保存会保留未知字段并写入上游结构', () => {
  const next = mergeHermesTtsVoiceConfig({
    model: { provider: 'anthropic' },
    tts: {
      provider: 'edge',
      custom_flag: 'keep-tts',
      openai: { custom_flag: 'keep-openai' },
      piper: { voices_dir: '/cache/piper' },
    },
    voice: {
      custom_flag: 'keep-voice',
    },
    streaming: { enabled: true },
  }, {
    ttsProvider: 'openai',
    ttsEdgeVoice: 'zh-CN-XiaoxiaoNeural',
    ttsOpenaiModel: 'gpt-4o-mini-tts',
    ttsOpenaiVoice: 'nova',
    ttsElevenlabsVoiceId: 'voice-123',
    ttsElevenlabsModelId: 'eleven_turbo_v2_5',
    ttsXaiVoiceId: 'eve-pro',
    ttsXaiLanguage: 'zh',
    ttsXaiSampleRate: '48000',
    ttsXaiBitRate: '192000',
    ttsMistralModel: 'voxtral-mini-tts-2603',
    ttsMistralVoiceId: 'mistral-voice',
    ttsPiperVoice: 'zh_CN-huayan-medium',
    voiceRecordKey: 'ctrl+shift+v',
    voiceMaxRecordingSeconds: '240',
    voiceAutoTts: true,
    voiceBeepEnabled: false,
    voiceSilenceThreshold: '350',
    voiceSilenceDuration: '1.5',
  })

  assert.deepEqual(next.model, { provider: 'anthropic' })
  assert.deepEqual(next.streaming, { enabled: true })
  assert.equal(next.tts.provider, 'openai')
  assert.equal(next.tts.edge.voice, 'zh-CN-XiaoxiaoNeural')
  assert.equal(next.tts.openai.model, 'gpt-4o-mini-tts')
  assert.equal(next.tts.openai.voice, 'nova')
  assert.equal(next.tts.openai.custom_flag, 'keep-openai')
  assert.equal(next.tts.elevenlabs.voice_id, 'voice-123')
  assert.equal(next.tts.elevenlabs.model_id, 'eleven_turbo_v2_5')
  assert.equal(next.tts.xai.sample_rate, 48000)
  assert.equal(next.tts.xai.bit_rate, 192000)
  assert.equal(next.tts.mistral.voice_id, 'mistral-voice')
  assert.equal(next.tts.piper.voice, 'zh_CN-huayan-medium')
  assert.equal(next.tts.piper.voices_dir, '/cache/piper')
  assert.equal(next.tts.custom_flag, 'keep-tts')
  assert.equal(next.voice.record_key, 'ctrl+shift+v')
  assert.equal(next.voice.max_recording_seconds, 240)
  assert.equal(next.voice.auto_tts, true)
  assert.equal(next.voice.beep_enabled, false)
  assert.equal(next.voice.silence_threshold, 350)
  assert.equal(next.voice.silence_duration, 1.5)
  assert.equal(next.voice.custom_flag, 'keep-voice')
})

test('Hermes TTS/Voice 配置保存空可选字段会删除对应覆盖', () => {
  const next = mergeHermesTtsVoiceConfig({
    tts: {
      edge: { voice: 'custom-edge' },
      elevenlabs: { voice_id: 'voice-123', model_id: 'model-123' },
      piper: { voice: 'custom-piper', voices_dir: '/cache/piper' },
    },
    voice: {
      record_key: 'ctrl+shift+v',
      custom_flag: 'keep-voice',
    },
  }, {
    ttsEdgeVoice: '',
    ttsElevenlabsVoiceId: ' ',
    ttsElevenlabsModelId: '',
    ttsPiperVoice: '',
    voiceRecordKey: '',
  })

  assert.equal(Object.hasOwn(next.tts.edge, 'voice'), false)
  assert.equal(Object.hasOwn(next.tts.elevenlabs, 'voice_id'), false)
  assert.equal(Object.hasOwn(next.tts.elevenlabs, 'model_id'), false)
  assert.equal(Object.hasOwn(next.tts.piper, 'voice'), false)
  assert.equal(next.tts.piper.voices_dir, '/cache/piper')
  assert.equal(Object.hasOwn(next.voice, 'record_key'), false)
  assert.equal(next.voice.custom_flag, 'keep-voice')
})

test('Hermes TTS/Voice 配置保存会拒绝非法枚举和越界值', () => {
  assert.throws(
    () => mergeHermesTtsVoiceConfig({}, { ttsProvider: 'bad' }),
    /tts\.provider/,
  )
  assert.throws(
    () => mergeHermesTtsVoiceConfig({}, { ttsOpenaiVoice: 'robot' }),
    /tts\.openai\.voice/,
  )
  assert.throws(
    () => mergeHermesTtsVoiceConfig({}, { ttsXaiSampleRate: '0' }),
    /tts\.xai\.sample_rate/,
  )
  assert.throws(
    () => mergeHermesTtsVoiceConfig({}, { voiceMaxRecordingSeconds: '0' }),
    /voice\.max_recording_seconds/,
  )
  assert.throws(
    () => mergeHermesTtsVoiceConfig({}, { voiceSilenceDuration: '-1' }),
    /voice\.silence_duration/,
  )
})
