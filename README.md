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
- **Dynamic Difficulty & Gap Scaling:** Pipe gaps scale with viewport height (capped) so shrinking the window no longer makes the game trivial.
- **Viewport Integrity Enforcement:** Viewport dimensions & devicePixelRatio at session start are captured; significant shrink or zoom-out voids the run (client-side) and is rejected server-side.

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
- **Anti-Cheat Flow (Enhanced):**
  1. After the countdown, the client captures `viewport = { w, h, dpr }` and starts a session via `POST /api/start` with that JSON body (optional legacy clients can still send empty body).
  2. The Durable Object stores `start_ts` plus the viewport metadata.
  3. During play, if the user shrinks the window or zooms so width/height or DPR drop below 85% of the starting values, the run is voided client-side (score will not submit).
  4. On game over, the client sends `POST /api/score` with `{ name, score, session_id, viewport_w, viewport_h, dpr }`.
  5. Server validates:
     - Session exists & not reused.
     - Score matches elapsed time within ±3 seconds worth of frames.
     - (If viewport was recorded) Current width, height, and DPR have not shrunk by >15%.
  6. Accepts and stores top scores (truncates to 100) or returns a 400 with rejection details.

### Dynamic Gap Scaling
Previously a fixed pixel pipe gap made the game much easier if the user reduced viewport height or zoomed in (less vertical travel needed). The gap is now computed as:

```
effectiveHeight = min(actualCanvasHeight, 900)
basePct = 220 / 900
gap = max(minPipeGap, (effectiveHeight * basePct) - level * 12)
```

This keeps difficulty roughly consistent across devices while still allowing play on smaller screens.

### Viewport Integrity
The initial viewport acts as a baseline. A run is invalidated if any of these shrink beyond 15% of their initial value:
- Width
- Height
- devicePixelRatio

This neutralizes exploits that relied on shrinking / zooming after starting to inflate performance.

### API Endpoints

| Method | Path              | Description |
|--------|-------------------|-------------|
| GET    | `/`               | Game HTML |
| POST   | `/api/start`      | Create a gameplay session (optional body: `{ w, h, dpr }`) -> `{ session_id }` |
| POST   | `/api/score`      | Submit final score `{ name, score, session_id, viewport_w, viewport_h, dpr }` |
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
If invalid, server returns `400` with JSON. Examples:

Score/time mismatch:
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

Viewport shrink / zoom detection:
```json
{
  "accepted": false,
  "reason": "viewport shrink / zoom detected",
  "viewport": {"vw": 640, "vh": 420, "dpr": 1}
}
```

### Adjusting Tolerance & Thresholds
Modify in `src/lib.rs`:
- `tolerance_seconds` (default 3) for timing tolerance.
- `SHRINK_THRESHOLD` (default 0.85) for viewport integrity.
Client-side mid-run invalidation uses the same 0.85 constant (see `static/game.js`).

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
