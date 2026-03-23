import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type SpotifyEnvelope = {
	source: 'spotify' | 'cache';
	throttled: boolean;
	lastFetchedAt: string | null;
	data: unknown;
	error: string | null;
};

type SpotifyTokenStore = {
	accessToken: string;
	refreshToken: string;
	expiresAtMs: number;
};

const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID ?? '').trim();
const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET ?? '').trim();
const TOKEN_FILE_PATH = resolve(process.cwd(), process.env.SPOTIFY_TOKEN_FILE ?? './data/spotify/tokens.json');

const MAX_UPSTREAM_REQUESTS = 5;
const REQUEST_WINDOW_MS = 30_000;
const CACHE_TTL_MS = 6_000;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

let accessToken = (process.env.SPOTIFY_ACCESS_TOKEN ?? '').trim();
let refreshToken = (process.env.SPOTIFY_REFRESH_TOKEN ?? '').trim();
let accessTokenExpiresAtMs = 0;

let tokenStoreLoaded = false;
let lastFetchMs = 0;
let lastPayload: unknown = null;
const upstreamFetchTimes: number[] = [];
let inflight: Promise<SpotifyEnvelope> | null = null;
let spotifyBlockedUntilMs = 0;
let retryBackoffMs = 1_000;

const nowMs = () => Date.now();
const base64 = (value: string) => Buffer.from(value, 'utf-8').toString('base64');

const pruneRequestWindow = (now: number) => {
	while (upstreamFetchTimes.length > 0 && now - upstreamFetchTimes[0] > REQUEST_WINDOW_MS) {
		upstreamFetchTimes.shift();
	}
};

const parseTokenExpiryMs = (expiresInSeconds: unknown): number => {
	if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds)) {
		return nowMs() + 30 * 60_000;
	}
	return nowMs() + Math.max(300, Math.round(expiresInSeconds)) * 1000;
};

const loadTokenStore = () => {
	if (tokenStoreLoaded) return;
	tokenStoreLoaded = true;
	try {
		const raw = readFileSync(TOKEN_FILE_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<SpotifyTokenStore>;
		if (typeof parsed.accessToken === 'string' && parsed.accessToken.trim()) {
			accessToken = parsed.accessToken.trim();
		}
		if (typeof parsed.refreshToken === 'string' && parsed.refreshToken.trim()) {
			refreshToken = parsed.refreshToken.trim();
		}
		if (typeof parsed.expiresAtMs === 'number' && Number.isFinite(parsed.expiresAtMs)) {
			accessTokenExpiresAtMs = parsed.expiresAtMs;
		}
	} catch {
		// token file is optional
	}
};

const persistTokenStore = () => {
	if (!accessToken && !refreshToken) return;
	mkdirSync(dirname(TOKEN_FILE_PATH), { recursive: true });
	const payload: SpotifyTokenStore = {
		accessToken,
		refreshToken,
		expiresAtMs: accessTokenExpiresAtMs
	};
	writeFileSync(TOKEN_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
};

const parseRetryAfterSeconds = (value: string | null): number | null => {
	if (!value) return null;
	const numeric = Number.parseInt(value, 10);
	if (Number.isFinite(numeric) && numeric > 0) {
		return numeric;
	}
	return null;
};

const assertSpotifyAppConfigured = () => {
	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
		throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
	}
};

const ensureAccessToken = async (): Promise<string> => {
	loadTokenStore();

	const now = nowMs();
	if (accessToken && now + TOKEN_EXPIRY_SAFETY_MS < accessTokenExpiresAtMs) {
		return accessToken;
	}

	if (!refreshToken) {
		if (accessToken) {
			return accessToken;
		}
		throw new Error(
			'Spotify not configured for currently-playing. Set SPOTIFY_REFRESH_TOKEN (user token) or a valid SPOTIFY_ACCESS_TOKEN.'
		);
	}

	assertSpotifyAppConfigured();

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});

	const response = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${base64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (response.status === 429) {
		const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after')) ?? 2;
		spotifyBlockedUntilMs = nowMs() + retryAfterSeconds * 1000;
		throw new Error(`Spotify token refresh rate-limited. Retry after ${retryAfterSeconds}s`);
	}

	if (!response.ok) {
		throw new Error(`Spotify token refresh failed with ${response.status}`);
	}

	const payload = (await response.json()) as {
		access_token?: string;
		expires_in?: number;
		refresh_token?: string;
	};
	if (!payload.access_token) {
		throw new Error('Spotify token refresh response missing access_token');
	}

	accessToken = payload.access_token;
	accessTokenExpiresAtMs = parseTokenExpiryMs(payload.expires_in);
	if (payload.refresh_token && payload.refresh_token.trim()) {
		refreshToken = payload.refresh_token.trim();
	}
	persistTokenStore();
	return accessToken;
};

const fetchCurrentlyPlayingFromSpotify = async (): Promise<unknown> => {
	const now = nowMs();
	if (now < spotifyBlockedUntilMs) {
		const waitSeconds = Math.max(1, Math.ceil((spotifyBlockedUntilMs - now) / 1000));
		throw new Error(`Spotify temporarily backed off. Retry after ${waitSeconds}s`);
	}

	const token = await ensureAccessToken();
	const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
		headers: {
			Authorization: `Bearer ${token}`
		}
	});

	if (response.status === 204) {
		retryBackoffMs = 1_000;
		return {
			context: null,
			is_playing: false,
			item: null,
			currently_playing_type: null,
			timestamp: nowMs()
		};
	}

	if (response.status === 429) {
		const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));
		const backoffMs = retryAfterSeconds ? retryAfterSeconds * 1000 : retryBackoffMs;
		spotifyBlockedUntilMs = nowMs() + backoffMs;
		retryBackoffMs = Math.min(60_000, retryBackoffMs * 2);
		throw new Error(`Spotify rate-limited currently-playing requests. Retry after ${Math.ceil(backoffMs / 1000)}s`);
	}

	if (response.status === 401 || response.status === 403) {
		throw new Error(
			'Spotify token is not valid for /me/player/currently-playing. Use /spotify/connect and approve playback scopes.'
		);
	}

	if (!response.ok) {
		let detail = '';
		try {
			const payload = (await response.json()) as { error?: { message?: string } };
			detail = payload.error?.message ? `: ${payload.error.message}` : '';
		} catch {
			// ignore parse failure
		}
		throw new Error(`Spotify currently-playing fetch failed with ${response.status}${detail}`);
	}

	retryBackoffMs = 1_000;
	return await response.json();
};

const cachedEnvelope = (error: string | null, throttled: boolean): SpotifyEnvelope => ({
	source: 'cache',
	throttled,
	lastFetchedAt: lastFetchMs > 0 ? new Date(lastFetchMs).toISOString() : null,
	data: lastPayload,
	error
});

const fetchEnvelope = async (): Promise<SpotifyEnvelope> => {
	const now = nowMs();
	pruneRequestWindow(now);

	if (lastPayload !== null && now - lastFetchMs < CACHE_TTL_MS) {
		return cachedEnvelope(null, false);
	}

	if (upstreamFetchTimes.length >= MAX_UPSTREAM_REQUESTS) {
		if (lastPayload !== null) {
			return cachedEnvelope('Spotify upstream poll cap reached (5 requests / 30 seconds)', true);
		}
		return {
			source: 'spotify',
			throttled: true,
			lastFetchedAt: null,
			data: null,
			error: 'Spotify upstream poll cap reached and no cached payload is available'
		};
	}

	upstreamFetchTimes.push(now);
	try {
		const payload = await fetchCurrentlyPlayingFromSpotify();
		lastPayload = payload;
		lastFetchMs = nowMs();
		return {
			source: 'spotify',
			throttled: false,
			lastFetchedAt: new Date(lastFetchMs).toISOString(),
			data: payload,
			error: null
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown Spotify error';
		if (lastPayload !== null) {
			return cachedEnvelope(message, false);
		}
		return {
			source: 'spotify',
			throttled: false,
			lastFetchedAt: null,
			data: null,
			error: message
		};
	}
};

export const getSpotifyCurrentlyPlaying = async (): Promise<SpotifyEnvelope> => {
	if (!inflight) {
		inflight = fetchEnvelope().finally(() => {
			inflight = null;
		});
	}
	return inflight;
};
