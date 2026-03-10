use anyhow::Result;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;

const DEFAULT_API_URL: &str = "https://webact-api-227308092166.us-central1.run.app";
const TIMEOUT: Duration = Duration::from_secs(2);

fn api_base() -> String {
    std::env::var("WEBACT_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string())
}

pub async fn check_version(current: &str) -> Result<Value> {
    let url = format!("{}/v1/version?current={}", api_base(), current);
    let client = reqwest::Client::builder().timeout(TIMEOUT).build()?;
    let resp = client.get(&url).send().await?.json::<Value>().await?;
    Ok(resp)
}

pub async fn send_telemetry(
    session_id: &str,
    version: &str,
    platform: &str,
    duration_s: u64,
    tools: &HashMap<String, u64>,
) -> Result<()> {
    let url = format!("{}/v1/telemetry", api_base());
    let client = reqwest::Client::builder().timeout(TIMEOUT).build()?;
    client
        .post(&url)
        .json(&json!({
            "session_id": session_id,
            "version": version,
            "platform": platform,
            "duration_s": duration_s,
            "tools": tools,
        }))
        .send()
        .await?;
    Ok(())
}

pub async fn send_feedback(
    session_id: &str,
    version: &str,
    rating: u8,
    comment: &str,
) -> Result<()> {
    let url = format!("{}/v1/feedback", api_base());
    let client = reqwest::Client::builder().timeout(TIMEOUT).build()?;
    client
        .post(&url)
        .json(&json!({
            "session_id": session_id,
            "version": version,
            "rating": rating,
            "comment": comment,
        }))
        .send()
        .await?;
    Ok(())
}
