use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebactConfig {
    #[serde(default = "default_true")]
    pub telemetry: bool,
    #[serde(default = "default_true")]
    pub feedback: bool,
}

fn default_true() -> bool {
    true
}

impl Default for WebactConfig {
    fn default() -> Self {
        Self {
            telemetry: true,
            feedback: true,
        }
    }
}

pub fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".config")
        .join("webact")
        .join("webact.json")
}

pub fn load_config() -> WebactConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => WebactConfig::default(),
    }
}

pub fn save_config(config: &WebactConfig) -> Result<()> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json)?;
    Ok(())
}
