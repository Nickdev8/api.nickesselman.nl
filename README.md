# api.nickesselman.nl

Standalone JSON API service for Nick Esselman properties.

Current endpoints:

- `GET /stats` returns the live Fitbit-backed stats payload used by `nickesselman.nl`
- `GET /fitbit` returns the same payload on a source-specific path
- `GET /device-state` returns latest laptop+phone state with connected/disconnected labels
- `POST /device-state` ingests laptop-published state (bearer token required)
- `GET /phone-state` returns latest phone telemetry payload with connected/disconnected status
- `POST /phone-state` ingests phone telemetry directly (bearer token required)
- `GET /phone-state/stream` emits live SSE updates whenever `/phone-state` changes
- `GET /spotify/currently-playing` proxies Spotify currently-playing with upstream polling cap (5 per 30 seconds)
- `GET /github` returns GitHub contribution calendar data and recent commits
- `GET /github/commits` returns recent GitHub commits from public events or configured repositories
- `GET /github/contributions` returns GitHub contribution calendar data, defaulting to 1 year ending today
- `GET /badge/github.svg` returns a 1-year GitHub contribution SVG badge with today in the rightmost column
- `GET /badge/github/2y.svg` returns a 2-year GitHub contribution SVG badge with today in the rightmost column
- `GET /badge/github/latest.svg` returns an SVG badge for the latest GitHub commit

Docker:

- `docker compose up -d --build` starts the service on port `3101`
- Fitbit tokens persist in `./data/fitbit/tokens.json` via the `./data:/app/data` volume mount

Environment:

- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `FITBIT_ACCESS_TOKEN`
- `FITBIT_REFRESH_TOKEN`
- `FITBIT_EXPIRES_AT`
- `FITBIT_TOKEN_DIR` defaults to `./data/fitbit`
- `DEVICE_STATE_TOKEN` bearer token for `POST /device-state`
- `DEVICE_STATE_STALE_SECONDS` optional staleness threshold before API reports `no laptop connected` (default `45`)
- `PHONE_STATE_TOKEN` optional separate bearer token for `POST /phone-state` (falls back to `DEVICE_STATE_TOKEN`)
- `PHONE_STATE_STALE_SECONDS` optional staleness threshold before API reports `no phone connected` (default `1200`, matching Android's idle refresh cadence)
- `PHONE_STATE_FILE` optional persisted latest phone-state path (default `./data/phone-state/state.json`)
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN` user refresh token with `user-read-currently-playing` / `user-read-playback-state` scopes
- `SPOTIFY_ACCESS_TOKEN` (optional bootstrap token; endpoint can still serve cached data when refresh is unavailable)
- `SPOTIFY_TOKEN_FILE` optional token storage path (default `./data/spotify/tokens.json`)
- `GITHUB_OWNER` GitHub username for public event fallback and author filtering
- `GITHUB_TOKEN` optional GitHub token for private/configured repository feeds
- `GITHUB_FEED_REPOS` optional comma-separated `owner/repo` list to track directly
- `GITHUB_USE_REPO_FEED` optional truthy flag to fetch recent repos from the authenticated account
- `CONTRIBUTIONS_CACHE_FILE` optional persisted GitHub contribution cache path (default `./data/github-contributions-cache.json`)

Tokens are bootstrapped from env only when `tokens.json` is missing. After that, refreshed tokens are persisted to disk and reused across restarts.

Runtime behavior:

- Fitbit payloads are cached in-memory for `10 minutes` on healthy reads
- Failed upstream reads are cached too: `2 minutes` when empty and `5 minutes` when serving stale data
- Public clients are rate-limited with dual windows: `180/minute` and `900/10 minutes`
- Private and loopback clients are exempt so the colocated blog can fetch without tripping the limiter
