type SpotifyEnvelope = {
	source: 'spotify' | 'cache';
	throttled: boolean;
	lastFetchedAt: string | null;
	data: unknown;
	error: string | null;
};

const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID ?? '').trim();
const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET ?? '').trim();
const SPOTIFY_REFRESH_TOKEN = (process.env.SPOTIFY_REFRESH_TOKEN ?? '').trim();

const MAX_UPSTREAM_REQUESTS = 5;
const REQUEST_WINDOW_MS = 30_000;
const CACHE_TTL_MS = 6_000;
const TOKEN_EXPIRY_SAFETY_MS = 60_000;

let accessToken = (process.env.SPOTIFY_ACCESS_TOKEN ?? '').trim();
let accessTokenExpiresAtMs = 0;
let lastFetchMs = 0;
let lastPayload: unknown = null;
const upstreamFetchTimes: number[] = [];
let inflight: Promise<SpotifyEnvelope> | null = null;

const nowMs = () => Date.now();

const pruneRequestWindow = (now: number) => {
	while (upstreamFetchTimes.length > 0 && now - upstreamFetchTimes[0] > REQUEST_WINDOW_MS) {
		upstreamFetchTimes.shift();
	}
};

const base64 = (value: string) => Buffer.from(value, 'utf-8').toString('base64');

const parseTokenExpiryMs = (expiresInSeconds: unknown): number => {
	if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds)) {
		return nowMs() + 30 * 60_000;
	}
	return nowMs() + Math.max(300, Math.round(expiresInSeconds)) * 1000;
};

const ensureAccessToken = async (): Promise<string> => {
	const now = nowMs();
	if (accessToken && now + TOKEN_EXPIRY_SAFETY_MS < accessTokenExpiresAtMs) {
		return accessToken;
	}

	if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
		if (accessToken) {
			return accessToken;
		}
		throw new Error(
			'Spotify is not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN.'
		);
	}

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: SPOTIFY_REFRESH_TOKEN
	});
	const response = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${base64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
			'content-type': 'application/x-www-form-urlencoded'
		},
		body
	});
	if (!response.ok) {
		throw new Error(`Spotify token refresh failed with ${response.status}`);
	}

	const payload = (await response.json()) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!payload.access_token) {
		throw new Error('Spotify token refresh response missing access_token');
	}

	accessToken = payload.access_token;
	accessTokenExpiresAtMs = parseTokenExpiryMs(payload.expires_in);
	return accessToken;
};

const fetchCurrentlyPlayingFromSpotify = async (): Promise<unknown> => {
	const token = await ensureAccessToken();

	const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
		headers: {
			Authorization: `Bearer ${token}`
		}
	});

	if (response.status === 204) {
		return {
			context: null,
			is_playing: false,
			item: null,
			currently_playing_type: null,
			timestamp: nowMs()
		};
	}
	if (!response.ok) {
		throw new Error(`Spotify currently-playing fetch failed with ${response.status}`);
	}
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
