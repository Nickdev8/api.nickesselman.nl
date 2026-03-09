# api.nickesselman.nl

Standalone JSON API service for Nick Esselman properties.

Current endpoints:

- `GET /stats` returns the live Fitbit-backed stats payload used by `nickesselman.nl`
- `GET /fitbit` returns the same payload on a source-specific path

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

Tokens are bootstrapped from env only when `tokens.json` is missing. After that, refreshed tokens are persisted to disk and reused across restarts.

Runtime behavior:

- Fitbit payloads are cached in-memory for `10 minutes` on healthy reads
- Failed upstream reads are cached too: `2 minutes` when empty and `5 minutes` when serving stale data
- Public clients are rate-limited with dual windows: `180/minute` and `900/10 minutes`
- Private and loopback clients are exempt so the colocated blog can fetch without tripping the limiter
