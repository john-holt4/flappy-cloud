# Flappy Cloud

A Cloudflare-powered Flappy Bird clone built with Rust Workers, Durable Objects, and Workers AI.

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

## Cloudflare Services Used

- **Workers (Rust):** Main backend logic, routing, and asset serving.
- **Durable Objects:** Leaderboard and score storage.
- **Workers AI:** AI commentary for game-over events.

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

Set your Workers AI API token (or other secrets) using Wrangler:

```fish
npx wrangler secret put API_TOKEN
```

```fish
npx wrangler secret put API_TOKEN
```

### 3. Configure environment variables

Copy `.dev.vars-sample` to `.dev.vars` and fill in your AI and other required variables:

```fish
cp .dev.vars-sample .dev.vars
```

Edit `.dev.vars` and set your values:

```
# Example .dev.
ACCOUNT_ID="XXX"
API_TOKEN="XXX"
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
- **Leaderboard:** Scores are posted to `/api/score` and retrieved from `/api/leaderboard` using Durable Objects.
- **AI Commentary:** On game over, a prompt is sent to Workers AI via `/api/ai` for a witty cloud-themed comment.

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

## License
MIT

---
Enjoy Flappy Cloud! Powered by Cloudflare 🚀
