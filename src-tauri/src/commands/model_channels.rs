//! 统一模型渠道（Model Channels）
//!
//! 用户只维护一份「渠道 = Base URL + API Key + 可用模型列表」配置，
//! 由前端组合现有命令（write_openclaw_config / hermes_env_set /
//! hermes_model_config_save / localStorage）显式同步到 OpenClaw、Hermes 与晴辰助手。
//!
//! 本模块只负责渠道存储：
//! - 读取接口对 API Key 永远只返回掩码（apiKeySaved + apiKeyMask）；
//! - 写入支持 `__KEEP__` / 空值哨兵保留旧 Key（与创作中心一致）；
//! - 明文 Key 仅通过 reveal_model_channel_key 在同步时按渠道单独取出
//!   （先例：hermes_env_reveal）。
//!
//! 存储位置：openclaw_dir/clawpanel/model-channels.json —— 跟随 OpenClaw
//! 数据目录，便携迁移整体复制后自动生效（与媒体数据同一决策）。

use serde_json::{json, Map, Value};
use std::path::PathBuf;

const CHANNELS_FILE: &str = "model-channels.json";
/// 渠道数量上限：防呆，不是产品限制
const MAX_CHANNELS: usize = 100;

fn channels_path() -> PathBuf {
    super::openclaw_dir().join("clawpanel").join(CHANNELS_FILE)
}

fn default_channels_doc() -> Value {
    json!({ "version": 1, "channels": [], "syncState": {} })
}

fn str_of(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn is_keep_sentinel(key: &str) -> bool {
    key.is_empty() || key == "__KEEP__" || key == "••••••••" || key == "********"
}

/// 归一化单个模型条目：接受字符串或 { id, name? } 对象，id 为空则丢弃
fn normalize_model_entry(entry: &Value) -> Option<Value> {
    if let Some(id) = entry.as_str() {
        let id = id.trim();
        if id.is_empty() {
            return None;
        }
        return Some(json!({ "id": id }));
    }
    let id = str_of(entry, "id");
    if id.is_empty() {
        return None;
    }
    let mut out = Map::new();
    out.insert("id".into(), Value::String(id));
    let name = str_of(entry, "name");
    if !name.is_empty() {
        out.insert("name".into(), Value::String(name));
    }
    if let Some(ctx) = entry.get("contextWindow").and_then(Value::as_u64) {
        out.insert("contextWindow".into(), Value::Number(ctx.into()));
    }
    Some(Value::Object(out))
}

/// 归一化单个渠道；current 为同 id 的旧渠道（用于保留旧 Key）。
/// 返回 None 表示条目非法（缺 id/名称），直接丢弃。
fn normalize_channel(entry: &Value, current: Option<&Value>) -> Option<Value> {
    let id = str_of(entry, "id");
    let name = str_of(entry, "name");
    if id.is_empty() || name.is_empty() {
        return None;
    }
    let base_url = str_of(entry, "baseUrl").trim_end_matches('/').to_string();
    if !(base_url.is_empty() || base_url.starts_with("https://") || base_url.starts_with("http://"))
    {
        return None;
    }

    let incoming_key = str_of(entry, "apiKey");
    let api_key = if is_keep_sentinel(&incoming_key) {
        current.map(|c| str_of(c, "apiKey")).unwrap_or_default()
    } else {
        incoming_key
    };

    let mut models: Vec<Value> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    if let Some(arr) = entry.get("models").and_then(Value::as_array) {
        for item in arr {
            if let Some(model) = normalize_model_entry(item) {
                let model_id = str_of(&model, "id");
                if seen.insert(model_id) {
                    models.push(model);
                }
            }
        }
    }

    let default_model = str_of(entry, "defaultModel");
    let default_model =
        if !default_model.is_empty() && models.iter().any(|m| str_of(m, "id") == default_model) {
            default_model
        } else {
            // 默认模型必须在列表内；否则取第一个
            models.first().map(|m| str_of(m, "id")).unwrap_or_default()
        };

    let api_type = {
        let t = str_of(entry, "apiType");
        if t.is_empty() {
            "openai-completions".to_string()
        } else {
            t
        }
    };

    Some(json!({
        "id": id,
        "name": name,
        "presetKey": str_of(entry, "presetKey"),
        "baseUrl": base_url,
        "apiType": api_type,
        "apiKey": api_key,
        "models": models,
        "defaultModel": default_model,
        "enabled": entry.get("enabled").and_then(Value::as_bool).unwrap_or(true),
        "updatedAt": str_of(entry, "updatedAt"),
    }))
}

/// 归一化整个文档；current 提供旧文档以支持保留旧 Key
fn normalize_channels_doc(config: &Value, current: Option<&Value>) -> Value {
    let empty = Vec::new();
    let current_channels = current
        .and_then(|c| c.get("channels"))
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    let find_current = |id: &str| current_channels.iter().find(|c| str_of(c, "id") == id);

    let mut channels = Vec::new();
    if let Some(arr) = config.get("channels").and_then(Value::as_array) {
        let mut seen = std::collections::HashSet::new();
        for entry in arr.iter().take(MAX_CHANNELS) {
            let id = str_of(entry, "id");
            if !seen.insert(id.clone()) {
                continue;
            }
            if let Some(ch) = normalize_channel(entry, find_current(&id)) {
                channels.push(ch);
            }
        }
    }

    let sync_state = config
        .get("syncState")
        .filter(|v| v.is_object())
        .cloned()
        .unwrap_or_else(|| json!({}));

    json!({ "version": 1, "channels": channels, "syncState": sync_state })
}

fn read_channels_private() -> Value {
    let parsed = super::read_json_file_content(&channels_path())
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .unwrap_or_else(default_channels_doc);
    normalize_channels_doc(&parsed, None)
}

/// 对外读取：API Key 只回掩码
fn sanitize_doc_for_read(doc: &Value) -> Value {
    let mut out = doc.clone();
    if let Some(channels) = out.get_mut("channels").and_then(Value::as_array_mut) {
        for channel in channels {
            if let Some(obj) = channel.as_object_mut() {
                let api_key = obj
                    .get("apiKey")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                obj.insert("apiKey".into(), Value::String(String::new()));
                obj.insert(
                    "apiKeySaved".into(),
                    Value::Bool(!api_key.trim().is_empty()),
                );
                obj.insert(
                    "apiKeyMask".into(),
                    Value::String(super::media::api_key_mask(&api_key)),
                );
            }
        }
    }
    out
}

#[tauri::command]
pub fn read_model_channels() -> Result<Value, String> {
    Ok(sanitize_doc_for_read(&read_channels_private()))
}

#[tauri::command]
pub fn write_model_channels(config: Value) -> Result<Value, String> {
    let current = read_channels_private();
    let normalized = normalize_channels_doc(&config, Some(&current));
    super::media::write_json_atomic(&channels_path(), &normalized)?;
    Ok(sanitize_doc_for_read(&normalized))
}

/// 明文 Key 仅在同步 / 助手拷贝时按渠道取出，不进入常规读取链路
#[tauri::command]
pub fn reveal_model_channel_key(channel_id: String) -> Result<String, String> {
    let doc = read_channels_private();
    let channels = doc
        .get("channels")
        .and_then(Value::as_array)
        .ok_or_else(|| "渠道配置格式错误".to_string())?;
    let channel = channels
        .iter()
        .find(|c| str_of(c, "id") == channel_id.trim())
        .ok_or_else(|| format!("模型渠道不存在: {channel_id}"))?;
    Ok(str_of(channel, "apiKey"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_channel(id: &str, key: &str) -> Value {
        json!({
            "id": id,
            "name": "测试渠道",
            "presetKey": "openai",
            "baseUrl": "https://api.openai.com/v1/",
            "apiType": "openai-completions",
            "apiKey": key,
            "models": ["gpt-4o", { "id": "gpt-4o-mini", "name": "Mini" }, "", "gpt-4o"],
            "defaultModel": "gpt-4o-mini"
        })
    }

    #[test]
    fn normalize_trims_and_dedups_models() {
        let doc = normalize_channels_doc(
            &json!({ "channels": [sample_channel("ch-1", "sk-abcdefgh1234")] }),
            None,
        );
        let ch = &doc["channels"][0];
        assert_eq!(ch["baseUrl"], "https://api.openai.com/v1");
        let models = ch["models"].as_array().unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0]["id"], "gpt-4o");
        assert_eq!(models[1]["name"], "Mini");
        // 默认模型在列表内则保留
        assert_eq!(ch["defaultModel"], "gpt-4o-mini");
        assert_eq!(ch["enabled"], true);
    }

    #[test]
    fn keep_sentinel_preserves_old_key() {
        let current = normalize_channels_doc(
            &json!({ "channels": [sample_channel("ch-1", "sk-real-key-123")] }),
            None,
        );
        for sentinel in ["", "__KEEP__", "••••••••", "********"] {
            let incoming = json!({ "channels": [sample_channel("ch-1", sentinel)] });
            let merged = normalize_channels_doc(&incoming, Some(&current));
            assert_eq!(
                merged["channels"][0]["apiKey"], "sk-real-key-123",
                "sentinel {sentinel:?} 应保留旧 Key"
            );
        }
        // 新 Key 覆盖旧 Key
        let incoming = json!({ "channels": [sample_channel("ch-1", "sk-new")] });
        let merged = normalize_channels_doc(&incoming, Some(&current));
        assert_eq!(merged["channels"][0]["apiKey"], "sk-new");
    }

    #[test]
    fn read_sanitization_masks_key() {
        let doc = normalize_channels_doc(
            &json!({ "channels": [sample_channel("ch-1", "sk-abcdefgh1234")] }),
            None,
        );
        let public = sanitize_doc_for_read(&doc);
        let ch = &public["channels"][0];
        assert_eq!(ch["apiKey"], "");
        assert_eq!(ch["apiKeySaved"], true);
        assert_eq!(ch["apiKeyMask"], "sk-***1234");
    }

    #[test]
    fn invalid_entries_are_dropped() {
        let doc = normalize_channels_doc(
            &json!({ "channels": [
                { "name": "缺 id" },
                { "id": "ch-2", "name": "" },
                { "id": "ch-3", "name": "非法地址", "baseUrl": "ftp://x" },
                sample_channel("ch-4", "k"),
                sample_channel("ch-4", "k2")
            ] }),
            None,
        );
        let channels = doc["channels"].as_array().unwrap();
        assert_eq!(channels.len(), 1, "只有合法且未重复的渠道保留");
        assert_eq!(channels[0]["id"], "ch-4");
    }

    #[test]
    fn default_model_falls_back_to_first() {
        let mut entry = sample_channel("ch-1", "k");
        entry["defaultModel"] = json!("not-in-list");
        let doc = normalize_channels_doc(&json!({ "channels": [entry] }), None);
        assert_eq!(doc["channels"][0]["defaultModel"], "gpt-4o");
    }
}
