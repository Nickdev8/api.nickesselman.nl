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
