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
- `PHONE_STATE_STALE_SECONDS` optional staleness threshold before API reports `no phone connected` (default `90`)
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN` (required for automatic token refresh)
- `SPOTIFY_ACCESS_TOKEN` (optional bootstrap token; endpoint can still serve cached data when refresh is unavailable)

Tokens are bootstrapped from env only when `tokens.json` is missing. After that, refreshed tokens are persisted to disk and reused across restarts.

Runtime behavior:

- Fitbit payloads are cached in-memory for `10 minutes` on healthy reads
- Failed upstream reads are cached too: `2 minutes` when empty and `5 minutes` when serving stale data
- Public clients are rate-limited with dual windows: `180/minute` and `900/10 minutes`
- Private and loopback clients are exempt so the colocated blog can fetch without tripping the limiter
