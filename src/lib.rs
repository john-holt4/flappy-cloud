use js_sys::Math;
use serde::{Deserialize, Serialize};
use worker::*;
mod ai;

#[durable_object]
pub struct ScoreBoard {
    state: State,
    #[allow(dead_code)]
    env: Env,
}

#[derive(Serialize, Deserialize, Clone)]
struct ScoreEntry {
    name: String,
    score: i64,
    ts: f64,
}

#[derive(Serialize, Deserialize, Clone)]
struct SessionInfo {
    start_ts: f64,
    used: bool,
    #[serde(default)]
    start_w: Option<u32>,
    #[serde(default)]
    start_h: Option<u32>,
    #[serde(default)]
    dpr: Option<f64>,
}

impl DurableObject for ScoreBoard {
    fn new(state: State, env: Env) -> Self {
        Self { state, env }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        match (req.method(), url.path()) {
            (Method::Post, "/start") => {
                let mut start_w: Option<u32> = None;
                let mut start_h: Option<u32> = None;
                let mut dpr: Option<f64> = None;
                if let Ok(json) = req.json::<serde_json::Value>().await {
                    start_w = json.get("w").and_then(|v| v.as_u64()).map(|v| v as u32);
                    start_h = json.get("h").and_then(|v| v.as_u64()).map(|v| v as u32);
                    dpr = json.get("dpr").and_then(|v| v.as_f64());
                }
                let session_id = format!(
                    "sess_{}_{}",
                    Date::now().as_millis(),
                    (Math::random() * 1e12_f64) as u64
                );
                let info = SessionInfo {
                    start_ts: Date::now().as_millis() as f64,
                    used: false,
                    start_w,
                    start_h,
                    dpr,
                };
                self.state
                    .storage()
                    .put(&format!("session:{}", session_id), &info)
                    .await?;
                Response::from_json(&serde_json::json!({"session_id": session_id}))
            }
            (Method::Post, "/add") => {
                let data: serde_json::Value = req.json().await?;
                let name = data["name"].as_str().unwrap_or("anon").to_string();
                let score = data["score"].as_i64().unwrap_or(0);
                let session_id = data["session_id"].as_str().unwrap_or("");
                if session_id.is_empty() {
                    return Response::error("missing session_id", 400);
                }
                let key = format!("session:{}", session_id);
                let session: Option<SessionInfo> = self.state.storage().get(&key).await?;
                if session.is_none() {
                    return Response::error("invalid session", 400);
                }
                let mut session_info = session.unwrap();
                if session_info.used {
                    return Response::error("session already used", 400);
                }
                let now_ms = Date::now().as_millis() as f64;
                let elapsed_sec = (now_ms - session_info.start_ts) / 1000.0;
                let expected_score = elapsed_sec * 60.0;
                let tolerance_seconds = 3.0;
                let tolerance_frames = tolerance_seconds * 60.0;
                if (score as f64 - expected_score).abs() > tolerance_frames {
                    let body = serde_json::json!({
                        "accepted": false,
                        "reason": "score/time mismatch",
                        "elapsed_sec": elapsed_sec,
                        "expected_score": expected_score as i64,
                        "tolerance_frames": tolerance_frames as i64,
                        "actual_score": score
                    });
                    let resp = Response::from_json(&body)?.with_status(400);
                    return Ok(resp);
                }
                let vw = data["viewport_w"].as_u64().unwrap_or(0) as u32;
                let vh = data["viewport_h"].as_u64().unwrap_or(0) as u32;
                let dpr_now = data["dpr"].as_f64().unwrap_or(1.0);
                const SHRINK_THRESHOLD: f64 = 0.85; // 15% shrink triggers rejection
                let mut viewport_ok = true;
                let mut viewport_reason: Option<String> = None;
                if let (Some(sw), Some(sh)) = (session_info.start_w, session_info.start_h) {
                    if vw > 0
                        && vh > 0
                        && ((vw as f64) < sw as f64 * SHRINK_THRESHOLD
                            || (vh as f64) < sh as f64 * SHRINK_THRESHOLD)
                    {
                        viewport_ok = false;
                        viewport_reason = Some("viewport shrink / zoom detected".into());
                    }
                    if let Some(start_dpr) = session_info.dpr {
                        if dpr_now < start_dpr * SHRINK_THRESHOLD {
                            viewport_ok = false;
                            viewport_reason = Some("devicePixelRatio shrink detected".into());
                        }
                    }
                }
                if !viewport_ok {
                    let body = serde_json::json!({
                        "accepted": false,
                        "reason": viewport_reason.unwrap_or_else(|| "viewport violation".into()),
                        "viewport": {"vw": vw, "vh": vh, "dpr": dpr_now},
                    });
                    return Ok(Response::from_json(&body)?.with_status(400));
                }
                session_info.used = true;
                self.state.storage().put(&key, &session_info).await?;

                let ts = now_ms;
                let entry = ScoreEntry { name, score, ts };
                let mut scores: Vec<ScoreEntry> = self
                    .state
                    .storage()
                    .get::<Vec<ScoreEntry>>("scores")
                    .await
                    .unwrap_or_else(|_| Vec::new());
                scores.push(entry);
                scores.sort_by(|a, b| b.score.cmp(&a.score));
                if scores.len() > 100 {
                    scores.truncate(100);
                }
                self.state.storage().put("scores", &scores).await?;
                Response::from_json(&serde_json::json!({"accepted": true}))
            }
            (Method::Get, "/top") => {
                let scores: Vec<ScoreEntry> = self
                    .state
                    .storage()
                    .get::<Vec<ScoreEntry>>("scores")
                    .await
                    .unwrap_or_else(|_| Vec::new());
                let top: Vec<_> = scores
                    .into_iter()
                    .take(5)
                    .map(|s| (s.name, s.score))
                    .collect();
                Response::from_json(&top)
            }
            _ => Response::error("Not found", 404),
        }
    }
}

#[event(fetch)]
pub async fn main(mut req: Request, env: Env, _ctx: Context) -> Result<Response> {
    let url = req.url()?;
    match url.path() {
        "/" => Response::from_html(include_str!("../static/index.html")),
        "/api/score" => {
            let data: serde_json::Value = req.json().await?;
            let ns = env.durable_object("SCORE_BOARD")?;
            let id = ns.id_from_name("global")?;
            let stub = id.get_stub()?;
            let mut init = RequestInit::new();
            init.with_method(Method::Post);
            init.with_body(Some(serde_json::to_string(&data)?.into()));
            let do_req = Request::new_with_init("http://internal/add", &init)?;
            stub.fetch_with_request(do_req).await
        }
        "/api/start" => {
            let body_text = req.text().await.unwrap_or_default();
            let ns = env.durable_object("SCORE_BOARD")?;
            let id = ns.id_from_name("global")?;
            let stub = id.get_stub()?;
            let mut init = RequestInit::new();
            init.with_method(Method::Post);
            if !body_text.is_empty() {
                init.with_body(Some(body_text.clone().into()));
            }
            let do_req = Request::new_with_init("http://internal/start", &init)?;
            if !body_text.is_empty() {
                do_req
                    .headers()
                    .set("Content-Type", "application/json")
                    .ok();
            }
            stub.fetch_with_request(do_req).await
        }
        "/api/leaderboard" => {
            let ns = env.durable_object("SCORE_BOARD")?;
            let id = ns.id_from_name("global")?;
            let stub = id.get_stub()?;
            stub.fetch_with_str("http://internal/top").await
        }
        "/api/ai" => {
            let data: serde_json::Value = req.json().await?;
            let prompt = data["prompt"].as_str().unwrap_or("");
            let ai_result = ai::call_workers_ai(prompt, &env).await?;
            Response::from_json(&serde_json::json!({ "result": ai_result }))
        }
        path if path.starts_with("/static/") => {
            let cache = Cache::default();
            if let Some(resp) = cache.get(&req, false).await? {
                return Ok(resp);
            }
            let resp = match path {
                "/static/cf-logo.png" => {
                    let bytes = include_bytes!("../static/cf-logo.png");
                    Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "image/png").ok();
                        resp
                    })?
                }
                "/static/favi/apple-touch-icon.png" => {
                    let bytes = include_bytes!("../static/favi/apple-touch-icon.png");
                    Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "image/png").ok();
                        resp
                    })?
                }
                "/static/favi/favicon-32x32.png" => {
                    let bytes = include_bytes!("../static/favi/favicon-32x32.png");
                    Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "image/png").ok();
                        resp
                    })?
                }
                "/static/favi/favicon-16x16.png" => {
                    let bytes = include_bytes!("../static/favi/favicon-16x16.png");
                    Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "image/png").ok();
                        resp
                    })?
                }
                "/static/cloud.png" => {
                    let bytes = include_bytes!("../static/cloud.png");
                    Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "image/png").ok();
                        resp
                    })?
                }
                "/static/game.js" => {
                    let js = include_str!("../static/game.js").as_bytes().to_vec();
                    Response::from_body(worker::ResponseBody::Body(js)).map(|mut resp| {
                        resp.headers_mut()
                            .set("Content-Type", "application/javascript")
                            .ok();
                        resp.headers_mut()
                            .set("Cache-Control", "no-store, max-age=0")
                            .ok();
                        resp
                    })?
                }
                "/static/styles.css" => {
                    let css = include_str!("../static/styles.css").as_bytes().to_vec();
                    Response::from_body(worker::ResponseBody::Body(css)).map(|mut resp| {
                        resp.headers_mut().set("Content-Type", "text/css").ok();
                        resp
                    })?
                }
                "/static/index.html" => Response::from_html(include_str!("../static/index.html"))?,
                _ => Response::error("Not found", 404)?,
            };
            match path {
                "/static/cf-logo.png" => {
                    let bytes = include_bytes!("../static/cf-logo.png");
                    let cache_resp = Response::from_bytes(bytes.to_vec()).map(|mut r| {
                        r.headers_mut().set("Content-Type", "image/png").ok();
                        r
                    })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/favi/apple-touch-icon.png" => {
                    let bytes = include_bytes!("../static/favi/apple-touch-icon.png");
                    let cache_resp = Response::from_bytes(bytes.to_vec()).map(|mut r| {
                        r.headers_mut().set("Content-Type", "image/png").ok();
                        r
                    })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/favi/favicon-32x32.png" => {
                    let bytes = include_bytes!("../static/favi/favicon-32x32.png");
                    let cache_resp = Response::from_bytes(bytes.to_vec()).map(|mut r| {
                        r.headers_mut().set("Content-Type", "image/png").ok();
                        r
                    })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/favi/favicon-16x16.png" => {
                    let bytes = include_bytes!("../static/favi/favicon-16x16.png");
                    let cache_resp = Response::from_bytes(bytes.to_vec()).map(|mut r| {
                        r.headers_mut().set("Content-Type", "image/png").ok();
                        r
                    })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/cloud.png" => {
                    let bytes = include_bytes!("../static/cloud.png");
                    let cache_resp = Response::from_bytes(bytes.to_vec()).map(|mut r| {
                        r.headers_mut().set("Content-Type", "image/png").ok();
                        r
                    })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/game.js" => {}
                "/static/styles.css" => {
                    let css = include_str!("../static/styles.css").as_bytes().to_vec();
                    let cache_resp =
                        Response::from_body(worker::ResponseBody::Body(css)).map(|mut r| {
                            r.headers_mut().set("Content-Type", "text/css").ok();
                            r
                        })?;
                    cache.put(&req, cache_resp).await?;
                }
                "/static/index.html" => {}
                _ => {}
            }
            Ok(resp)
        }
        other => Response::error(format!("Not found: {}", other), 404),
    }
}
