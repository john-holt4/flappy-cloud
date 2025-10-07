# Flappy Cloud

A Cloudflare-powered Flappy Bird clone built with Rust Workers, Durable Objects, and Workers AI.

Demo - https://cf-flappy-cloud.nfr-ige-ptcatur.workers.dev/

---

## How to Play

- Click the **Play** button or press **Space** to start.
- Tap/click or press **Space** to make the cloud jump.
- Avoid the pipes and try to get the highest score!
- After a game over, check out the AI-powered commentary and leaderboard.

---

## Features

- **Cloudflare Worker (Rust):** The backend is written in Rust and deployed as a Cloudflare Worker for fast, global edge performance.
- **Durable Objects:** High-score leaderboard and persistent game state are managed using Durable Objects for strong consistency.
- **Workers AI:** Game-over commentary is generated using Cloudflare Workers AI, providing fun, cloud-themed feedback.
- **Static Assets:** All game assets (HTML, CSS, JS, images) are served from the Worker.
- **Session-based Anti-Cheat:** Each run gets a server-issued session; scores are only accepted if they match server-measured elapsed play time.

## Cloudflare Services Used

- **Workers (Rust):** Main backend logic, routing, and asset serving.
- **Durable Objects:** Leaderboard and score storage.
- **Workers AI:** AI commentary for game-over events.
- **Durable Objects (Session Validation):** The same DO also issues short-lived gameplay sessions used to validate scores.

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (for npm)
- [Rust](https://www.rust-lang.org/tools/install) (for building the Worker backend)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare account

### 1. Install dependencies

```fish
npm install
```

### 2. Configure secrets

Set your Workers AI (or other) secrets using Wrangler (add only once):

```fish
npx wrangler secret put API_TOKEN
```

### 3. (Optional) Local environment variables

If you maintain a `.dev.vars` file, create it and add any non-secret development-only values. Secrets should still be stored via `wrangler secret`.

Example `.dev.vars` (create manually if you need it):

```
# .dev.vars (DO NOT COMMIT SECRETS)
ACCOUNT_ID="YOUR_ACCOUNT"
```

### 4. Local development

Start the local dev server:

```fish
npx wrangler dev
```

### 5. Deploy to Cloudflare

Deploy your game to production:

```fish
npx wrangler deploy
```

## How It Works

- **Game Frontend:** Served from `/static/index.html`, `/static/styles.css`, `/static/game.js`, and image assets.
- **Leaderboard:** Scores are posted to `/api/score` (after a validated session) and retrieved from `/api/leaderboard` using Durable Objects.
- **AI Commentary:** On game over, a prompt is sent to Workers AI via `/api/ai` for a witty cloud-themed comment.
- **Anti-Cheat Flow:** The client requests `/api/start` right when gameplay actually begins (after the countdown). The server records a `start_ts` in a Durable Object session. When the game ends, the client POSTs `{ name, score, session_id }` to `/api/score`. The server:
  1. Looks up the session.
  2. Computes elapsed seconds.
  3. Converts expected frames ≈ `elapsed * 60` (game logic awards roughly 1 point per frame-equivalent unit).
  4. Allows a tolerance of 3 seconds worth of frames (180 frames) to account for timing variance.
  5. Rejects and returns HTTP 400 if the score is outside tolerance or session reused.
  6. Stores score and invalidates the session on success.

This prevents manual POSTs with inflated scores unless the attacker can also simulate realistic timing.

### API Endpoints

| Method | Path              | Description |
|--------|-------------------|-------------|
| GET    | `/`               | Game HTML |
| POST   | `/api/start`      | Create a gameplay session `{ session_id }` |
| POST   | `/api/score`      | Submit final score `{ name, score, session_id }` |
| GET    | `/api/leaderboard`| Top scores (array of `[name, score]`) |
| POST   | `/api/ai`         | AI commentary `{ prompt }` -> `{ result }` |

### Example cURL

```fish
# Start a session
curl -X POST https://<your-worker-domain>/api/start

# Submit a (fake) score to see validation failure
curl -X POST https://<your-worker-domain>/api/score \
  -H 'Content-Type: application/json' \
  -d '{"name":"test","score":999999,"session_id":"sess_..."}'

# Fetch leaderboard
curl https://<your-worker-domain>/api/leaderboard
```

### Score Rejection Responses
If invalid, server returns `400` with JSON:
```json
{
  "accepted": false,
  "reason": "score/time mismatch",
  "elapsed_sec": 4.94,
  "expected_score": 296,
  "tolerance_frames": 180,
  "actual_score": 120
}
```

### Adjusting Tolerance
If you observe legitimate rejections for long sessions, you can modify the tolerance logic (currently 3 seconds worth of frames) in `src/lib.rs` where `tolerance_seconds` is defined.

## File Structure

```
static/
  index.html      # Main game UI
  styles.css      # Game styles
  game.js         # Game logic
  cf-logo.png     # Logo
  cloud.png       # Bird sprite
  ...
src/
  lib.rs          # Rust Worker backend
  ai.rs           # Workers AI integration
  ...
.dev.vars-sample  # Example environment variables
wrangler.toml     # Wrangler config
```

## Notes
- Make sure your Cloudflare account has access to Workers AI and Durable Objects.
- For AI features, `.dev.vars` must be set with a valid API key.
- All secrets should be set using `wrangler secret put` for security.
- Score submissions require a valid session; if you see many 400 responses client-side, ensure the session is created after the countdown (front-end already handles this) and the user isn't tab-throttled heavily.

## Troubleshooting

| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| `400 {"accepted":false,...}` on score | Session started too early / reused / tampered score | Ensure `/api/start` happens right before gameplay, don't reuse `session_id` |
| Score not appearing | Submission rejected silently | Open dev tools console; check for "Score rejected" log |
| AI commentary missing | AI secret not configured | Add secret with `wrangler secret put API_TOKEN` |
| Large latency | Using free plan region far away | Deploy normally; CDN edge helps automatically |
| Ran out of top slots | Leaderboard stores only top 100 | Increase truncate limit in `src/lib.rs` if desired |

## Future Hardening Ideas
- HMAC-sign the score payload using a short-lived key tied to the session.
- Log rejected attempts (count per IP) to an Analytics Engine dataset.
- Add progressive difficulty checksum (server recomputes expected difficulty curve & score growth).
- Introduce server-issued nonce for each difficulty increment.

## License
MIT

---
Enjoy Flappy Cloud! Powered by Cloudflare 🚀
