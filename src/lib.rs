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

impl DurableObject for ScoreBoard {
    fn new(state: State, env: Env) -> Self {
        Self { state, env }
    }

    async fn fetch(&self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        match (req.method(), url.path()) {
            (Method::Post, "/add") => {
                let data: serde_json::Value = req.json().await?;
                let name = data["name"].as_str().unwrap_or("anon").to_string();
                let score = data["score"].as_i64().unwrap_or(0);
                let ts = Date::now().as_millis() as f64;
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
                Response::ok("stored")
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
        path if path.starts_with("/static/") => match path {
            "/static/cf-logo.png" => {
                let bytes = include_bytes!("../static/cf-logo.png");
                Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "image/png").ok();
                    resp
                })
            }
            "/static/favi/apple-touch-icon.png" => {
                let bytes = include_bytes!("../static/favi/apple-touch-icon.png");
                Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "image/png").ok();
                    resp
                })
            }
            "/static/favi/favicon-32x32.png" => {
                let bytes = include_bytes!("../static/favi/favicon-32x32.png");
                Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "image/png").ok();
                    resp
                })
            }
            "/static/favi/favicon-16x16.png" => {
                let bytes = include_bytes!("../static/favi/favicon-16x16.png");
                Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "image/png").ok();
                    resp
                })
            }
            "/static/cloud.png" => {
                let bytes = include_bytes!("../static/cloud.png");
                Response::from_bytes(bytes.to_vec()).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "image/png").ok();
                    resp
                })
            }
            "/static/game.js" => {
                let js = include_str!("../static/game.js").as_bytes().to_vec();
                Response::from_body(worker::ResponseBody::Body(js)).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "application/javascript").ok();
                    resp
                })
            }
            "/static/styles.css" => {
                let css = include_str!("../static/styles.css").as_bytes().to_vec();
                Response::from_body(worker::ResponseBody::Body(css)).map(|mut resp| {
                    resp.headers_mut().set("Content-Type", "text/css").ok();
                    resp
                })
            }
            "/static/index.html" => Response::from_html(include_str!("../static/index.html")),
            _ => Response::error("Not found", 404),
        },
        other => Response::error(format!("Not found: {}", other), 404),
    }
}
