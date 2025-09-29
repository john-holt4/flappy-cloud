use serde::{Deserialize, Serialize};
use worker::*;

#[derive(Serialize, Deserialize)]
pub struct AIRequest {
    pub prompt: String,
}

#[derive(Serialize, Deserialize)]
pub struct AIResponse {
    pub result: String,
}

pub async fn call_workers_ai(prompt: &str, env: &Env) -> Result<String> {
    let account_id = env.var("ACCOUNT_ID")?.to_string();
    let api_token = env.var("API_TOKEN")?.to_string();
    let ai_url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/meta/llama-2-7b-chat-int8",
        account_id
    );
    let mut req_init = RequestInit::new();
    req_init.with_method(Method::Post);
    let body = serde_json::json!({
        "prompt": prompt,
        "max_tokens": 128
    });
    req_init.with_body(Some(body.to_string().into()));
    let req = Request::new_with_init(&ai_url, &req_init)?;
    req.headers()
        .set("Authorization", &format!("Bearer {}", api_token))?;
    req.headers().set("Content-Type", "application/json")?;
    let mut resp = Fetch::Request(req).send().await?;
    let json: serde_json::Value = resp.json().await?;
    console_log!("AI raw response: {:?}", json);
    let result = json["result"]
        .as_str()
        .or_else(|| json["response"].as_str())
        .or_else(|| json["choices"].get(0).and_then(|c| c["text"].as_str()))
        .map(|s| s.to_string())
        .or_else(|| json["result"]["response"].as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| json.to_string());
    Ok(result)
}
