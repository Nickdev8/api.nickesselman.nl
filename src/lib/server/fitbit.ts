import { env } from '$env/dynamic/private';
import { existsSync, readFileSync } from 'fs';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export type StatsPayload = {
	steps: number | null;
	distanceKm: number | null;
	activeMinutes: number | null;
	caloriesOut: number | null;
	restingHeartRate: number | null;
	sleepDurationMinutes: number | null;
	sleepScore: number | null;
	heartRateBpm: number | null;
	stepsWeek: number | null;
	floors: number | null;
	errorMessage: string | null;
	lastUpdated: number | null;
	nextRefresh: number | null;
};

type TokenState = {
	accessToken: string | null;
	refreshToken: string | null;
	expiresAt: number;
};

type StoredTokens = {
	access_token: string;
	refresh_token: string;
	expires_at: number;
};

const MIN_REFRESH_SECONDS = 10 * 60;
const FITBIT_API_BASE = 'https://api.fitbit.com';
const EMPTY_STATS: StatsPayload = {
	steps: null,
	distanceKm: null,
	activeMinutes: null,
	caloriesOut: null,
	restingHeartRate: null,
	sleepDurationMinutes: null,
	sleepScore: null,
	heartRateBpm: null,
	stepsWeek: null,
	floors: null,
	errorMessage: null,
	lastUpdated: null,
	nextRefresh: null
};

let envLoaded = false;
let cache: StatsPayload = { ...EMPTY_STATS };
let tokenState: TokenState = {
	accessToken: null,
	refreshToken: null,
	expiresAt: 0
};
let tokenInvalid = false;
let inflight: Promise<StatsPayload> | null = null;
let tokenInitPromise: Promise<void> | null = null;

const loadEnvFile = (filePath: string) => {
	try {
		const contents = readFileSync(filePath, 'utf-8');
		contents
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
			.forEach((line) => {
				const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
				if (!match) return;
				const [, key, rawValue] = match;
				const value = rawValue.replace(/^['"]|['"]$/g, '');
				if (process.env[key] === undefined) {
					process.env[key] = value;
				}
			});
	} catch {
	}
};

const ensureEnvLoaded = () => {
	if (envLoaded) return;
	envLoaded = true;

	const cwd = process.cwd();
	const currentFile = fileURLToPath(import.meta.url);
	const projectRoot = path.resolve(path.dirname(currentFile), '../../..');
	const candidates = new Set([
		path.resolve(cwd, '.env'),
		path.join(projectRoot, '.env')
	]);

	for (const file of candidates) {
		if (existsSync(file)) {
			loadEnvFile(file);
		}
	}
};

const readEnv = (key: string) => process.env[key] ?? env[key];

const resolveTokenDir = () => {
	ensureEnvLoaded();

	const tokenDirEnv = readEnv('FITBIT_TOKEN_DIR');
	if (tokenDirEnv) {
		return path.resolve(tokenDirEnv);
	}

	const cwd = process.cwd();
	const currentFile = fileURLToPath(import.meta.url);
	const projectRoot = path.resolve(path.dirname(currentFile), '../../..');
	const candidates = [path.resolve(cwd, 'data/fitbit'), path.join(projectRoot, 'data/fitbit')];
	const existing = candidates.find((dir) => existsSync(dir) || existsSync(path.dirname(dir)));
	return existing ?? candidates[0];
};

const TOKEN_DIR = resolveTokenDir();
const TOKEN_FILE = path.join(TOKEN_DIR, 'tokens.json');

const nowSeconds = () => Math.floor(Date.now() / 1000);

const ensureTokenDir = async () => {
	try {
		await mkdir(TOKEN_DIR, { recursive: true });
	} catch {
	}
};

const loadTokensFromFile = async (): Promise<StoredTokens | null> => {
	try {
		const file = await readFile(TOKEN_FILE, 'utf-8');
		const parsed = JSON.parse(file) as StoredTokens;
		if (!parsed.access_token || !parsed.refresh_token) return null;

		const expiresAt = Number(parsed.expires_at);
		if (!Number.isFinite(expiresAt)) return null;

		return {
			access_token: parsed.access_token,
			refresh_token: parsed.refresh_token,
			expires_at: expiresAt
		};
	} catch {
		return null;
	}
};

const bootstrapTokensFromEnv = (): StoredTokens | null => {
	ensureEnvLoaded();

	const accessToken = readEnv('FITBIT_ACCESS_TOKEN');
	const refreshToken = readEnv('FITBIT_REFRESH_TOKEN');
	const expiresAt = readEnv('FITBIT_EXPIRES_AT');

	if (!accessToken || !refreshToken || !expiresAt) {
		return null;
	}

	const expires_at = Number(expiresAt);
	if (!Number.isFinite(expires_at)) return null;

	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		expires_at
	};
};

const writeTokensToFile = async (tokens: StoredTokens) => {
	await ensureTokenDir();

	const payload = JSON.stringify(tokens, null, 2);
	const tmpPath = `${TOKEN_FILE}.tmp`;
	await writeFile(tmpPath, payload, { encoding: 'utf-8' });
	await rename(tmpPath, TOKEN_FILE);
};

const initTokens = async () => {
	if (tokenInitPromise) {
		return tokenInitPromise;
	}

	tokenInitPromise = (async () => {
		await ensureTokenDir();

		let tokens = await loadTokensFromFile();
		if (!tokens) {
			tokens = bootstrapTokensFromEnv();
			if (!tokens) {
				throw new Error('Fitbit tokens are missing; provide env vars for initial bootstrap.');
			}
			await writeTokensToFile(tokens);
		}

		tokenState = {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token,
			expiresAt: tokens.expires_at
		};
	})().catch((error) => {
		tokenInitPromise = null;
		throw error;
	});

	return tokenInitPromise;
};

const applyEnvTokens = async (): Promise<boolean> => {
	const envTokens = bootstrapTokensFromEnv();
	if (!envTokens) return false;

	tokenState = {
		accessToken: envTokens.access_token,
		refreshToken: envTokens.refresh_token,
		expiresAt: envTokens.expires_at
	};

	await writeTokensToFile(envTokens);
	return true;
};

const setTokens = (accessToken: string, refreshToken: string | null, expiresInSeconds: number) => {
	const expiration = nowSeconds() + (Number(expiresInSeconds) || 0);

	tokenState = {
		accessToken,
		refreshToken: refreshToken || tokenState.refreshToken,
		expiresAt: expiration
	};

	const stored: StoredTokens = {
		access_token: tokenState.accessToken || '',
		refresh_token: tokenState.refreshToken || '',
		expires_at: tokenState.expiresAt
	};

	writeTokensToFile(stored).catch((error) => {
		console.error('Failed to persist Fitbit tokens', error);
	});
};

const refreshAccessToken = async (allowEnvReset = true): Promise<boolean> => {
	await initTokens();

	ensureEnvLoaded();
	const clientId = readEnv('FITBIT_CLIENT_ID');
	const clientSecret = readEnv('FITBIT_CLIENT_SECRET');

	if (!clientId || !clientSecret || !tokenState.refreshToken) {
		throw new Error('Fitbit credentials are missing');
	}

	const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: tokenState.refreshToken
	});

	const response = await fetch(`${FITBIT_API_BASE}/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basicAuth}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	});

	if (!response.ok) {
		const text = await response.text();
		const isInvalidGrant = response.status === 400 && text.includes('invalid_grant');

		if (isInvalidGrant && allowEnvReset) {
			const reset = await applyEnvTokens();
			if (reset) {
				return refreshAccessToken(false);
			}
		}

		if (isInvalidGrant) {
			tokenInvalid = true;
			tokenState = {
				accessToken: null,
				refreshToken: tokenState.refreshToken,
				expiresAt: 0
			};
			return false;
		}

		throw new Error(`Failed to refresh Fitbit token: ${response.status} ${text}`);
	}

	const data = await response.json();
	setTokens(data.access_token, data.refresh_token, data.expires_in);
	tokenInvalid = false;
	return true;
};

const ensureValidAccessToken = async () => {
	await initTokens();

	const now = nowSeconds();
	if (!tokenState.accessToken) {
		return refreshAccessToken();
	}

	if (now >= tokenState.expiresAt - 30) {
		return refreshAccessToken();
	}

	tokenInvalid = false;
	return true;
};

const fetchActivity = async (): Promise<
	Pick<
		StatsPayload,
		'steps' | 'distanceKm' | 'activeMinutes' | 'caloriesOut' | 'restingHeartRate'
	>
> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) {
		return {
			steps: null,
			distanceKm: null,
			activeMinutes: null,
			caloriesOut: null,
			restingHeartRate: null
		};
	}

	const today = new Date().toISOString().slice(0, 10);
	const response = await fetch(`${FITBIT_API_BASE}/1/user/-/activities/date/${today}.json`, {
		headers: {
			Authorization: `Bearer ${tokenState.accessToken}`
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch activity: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as {
		summary?: {
			steps?: number;
			caloriesOut?: number;
			restingHeartRate?: number;
			fairlyActiveMinutes?: number;
			veryActiveMinutes?: number;
		};
		distances?: { activity?: string; distance?: number }[];
	};

	const summary = payload.summary || {};
	const activeMinutes =
		(summary.fairlyActiveMinutes || 0) + (summary.veryActiveMinutes || 0) || null;
	const distances = Array.isArray(payload.distances) ? payload.distances : [];
	const totalDistance =
		distances.find((entry) => entry.activity === 'total')?.distance ??
		(distances.length ? distances[0]?.distance : null);

	return {
		steps: typeof summary.steps === 'number' ? summary.steps : null,
		distanceKm: typeof totalDistance === 'number' ? totalDistance : null,
		activeMinutes,
		caloriesOut: typeof summary.caloriesOut === 'number' ? summary.caloriesOut : null,
		restingHeartRate:
			typeof summary.restingHeartRate === 'number' ? summary.restingHeartRate : null
	};
};

const fetchSleep = async (): Promise<Pick<StatsPayload, 'sleepDurationMinutes' | 'sleepScore'>> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) {
		return { sleepDurationMinutes: null, sleepScore: null };
	}

	const today = new Date().toISOString().slice(0, 10);
	const response = await fetch(`${FITBIT_API_BASE}/1.2/user/-/sleep/date/${today}.json`, {
		headers: {
			Authorization: `Bearer ${tokenState.accessToken}`
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch sleep: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as {
		sleep?: { isMainSleep?: boolean; duration?: number; score?: number }[];
	};

	const sleeps = Array.isArray(payload.sleep) ? payload.sleep : [];
	const primary =
		sleeps.find((entry) => entry.isMainSleep) || (sleeps.length ? sleeps[0] : undefined);
	const durationMinutes =
		typeof primary?.duration === 'number'
			? Math.round(primary.duration / (1000 * 60))
			: null;

	return {
		sleepDurationMinutes: durationMinutes,
		sleepScore: typeof primary?.score === 'number' ? primary.score : null
	};
};

const fetchHeartRate = async (): Promise<number | null> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) return null;

	const today = new Date().toISOString().slice(0, 10);

	try {
		const response = await fetch(
			`${FITBIT_API_BASE}/1/user/-/activities/heart/date/${today}/1d/1min.json`,
			{
				headers: {
					Authorization: `Bearer ${tokenState.accessToken}`
				}
			}
		);

		if (response.ok) {
			const payload = (await response.json()) as {
				'activities-heart-intraday'?: { dataset?: { value?: number }[] };
			};
			const dataset = payload['activities-heart-intraday']?.dataset || [];
			const latest = dataset[dataset.length - 1]?.value;
			if (typeof latest === 'number' && Number.isFinite(latest)) {
				return latest;
			}
		}
	} catch (error) {
		console.error('Fitbit heart intraday fetch error:', error);
	}

	try {
		const response = await fetch(`${FITBIT_API_BASE}/1/user/-/activities/heart/date/${today}/1d.json`, {
			headers: {
				Authorization: `Bearer ${tokenState.accessToken}`
			}
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to fetch heart summary: ${response.status} ${text}`);
		}

		const payload = (await response.json()) as {
			'activities-heart'?: { value?: { restingHeartRate?: number } }[];
		};
		const heartRate = payload['activities-heart']?.[0]?.value?.restingHeartRate;
		if (typeof heartRate === 'number' && Number.isFinite(heartRate)) {
			return heartRate;
		}
	} catch (error) {
		console.error('Fitbit heart summary fetch error:', error);
	}

	return null;
};

const fetchStepsWeek = async (): Promise<number | null> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) return null;

	const response = await fetch(`${FITBIT_API_BASE}/1/user/-/activities/steps/date/today/7d.json`, {
		headers: {
			Authorization: `Bearer ${tokenState.accessToken}`
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch weekly steps: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as {
		'activities-steps'?: { value?: string | number }[];
	};

	const series = payload['activities-steps'] || [];
	const total = series.reduce((sum, entry) => {
		const value =
			typeof entry?.value === 'string' ? Number.parseInt(entry.value, 10) : entry?.value;
		return sum + (Number.isFinite(value as number) ? Number(value) : 0);
	}, 0);

	return Number.isFinite(total) ? total : null;
};

const fetchFloors = async (): Promise<number | null> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) return null;

	const today = new Date().toISOString().slice(0, 10);
	const response = await fetch(`${FITBIT_API_BASE}/1/user/-/activities/floors/date/${today}/1d.json`, {
		headers: {
			Authorization: `Bearer ${tokenState.accessToken}`
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch floors: ${response.status} ${text}`);
	}

	const payload = (await response.json()) as {
		'activities-floors'?: { value?: string | number }[];
	};

	const todayEntry = payload['activities-floors']?.[0];
	if (!todayEntry?.value) return null;

	const value =
		typeof todayEntry.value === 'string'
			? Number.parseInt(todayEntry.value, 10)
			: todayEntry.value;
	return Number.isFinite(value) ? value : null;
};

const fetchStepsLast24h = async (): Promise<number | null> => {
	const ready = await ensureValidAccessToken();
	if (!ready || !tokenState.accessToken) return null;

	const now = new Date();
	const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const formatDate = (date: Date) => date.toISOString().slice(0, 10);

	const fetchDay = async (dateStr: string) => {
		const response = await fetch(
			`${FITBIT_API_BASE}/1/user/-/activities/steps/date/${dateStr}/1d/1min.json`,
			{
				headers: {
					Authorization: `Bearer ${tokenState.accessToken}`
				}
			}
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to fetch intraday steps (${dateStr}): ${response.status} ${text}`);
		}

		const payload = (await response.json()) as {
			'activities-steps-intraday'?: { dataset?: { time?: string; value?: number }[] };
		};

		return payload['activities-steps-intraday']?.dataset || [];
	};

	let intradayTotal: number | null = null;

	try {
		const [yesterdayData, todayData] = await Promise.all([
			fetchDay(formatDate(yesterday)),
			fetchDay(formatDate(now))
		]);

		const datasets = [
			...yesterdayData.map((entry) => ({ ...entry, dateStr: formatDate(yesterday) })),
			...todayData.map((entry) => ({ ...entry, dateStr: formatDate(now) }))
		];

		if (datasets.length === 0) {
			intradayTotal = null;
		} else {
			const boundary = now.getTime() - 24 * 60 * 60 * 1000;
			const total = datasets.reduce((sum, entry) => {
				if (!entry.time || typeof entry.value !== 'number' || !entry.dateStr) {
					return sum;
				}

				const timestamp = new Date(`${entry.dateStr}T${entry.time}`).getTime();
				if (Number.isNaN(timestamp) || timestamp < boundary || timestamp > now.getTime()) {
					return sum;
				}

				return sum + entry.value;
			}, 0);

			intradayTotal = Number.isFinite(total) ? total : null;
		}
	} catch (error) {
		console.error('Fitbit steps 24h fetch error:', error);
	}

	if (intradayTotal !== null) {
		return intradayTotal;
	}

	try {
		const start = formatDate(yesterday);
		const end = formatDate(now);
		const response = await fetch(
			`${FITBIT_API_BASE}/1/user/-/activities/steps/date/${start}/${end}.json`,
			{
				headers: {
					Authorization: `Bearer ${tokenState.accessToken}`
				}
			}
		);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to fetch daily steps fallback: ${response.status} ${text}`);
		}

		const payload = (await response.json()) as {
			'activities-steps'?: { value?: string | number }[];
		};

		const series = payload['activities-steps'] || [];
		const total = series.slice(-2).reduce((sum, entry) => {
			const value =
				typeof entry?.value === 'string' ? Number.parseInt(entry.value, 10) : entry?.value;
			return sum + (Number.isFinite(value as number) ? Number(value) : 0);
		}, 0);

		return Number.isFinite(total) ? total : null;
	} catch (error) {
		console.error('Fitbit steps daily fallback error:', error);
		return null;
	}
};

export const getFitbitStats = async (): Promise<StatsPayload> => {
	const now = nowSeconds();

	if (cache.lastUpdated && cache.nextRefresh && now < cache.nextRefresh) {
		return cache;
	}

	if (inflight) {
		return inflight;
	}

	inflight = (async () => {
		const previous = cache;
		let activity: Awaited<ReturnType<typeof fetchActivity>> | null = null;
		let sleep: Awaited<ReturnType<typeof fetchSleep>> | null = null;
		let heartRate: number | null = null;
		let stepsWeek: number | null = null;
		let floors: number | null = null;
		let steps24h: number | null = null;
		let fetchErrorMessage: string | null = null;

		const rememberError = (error: unknown) => {
			if (tokenInvalid || fetchErrorMessage) return;
			if (error instanceof Error && error.message) {
				fetchErrorMessage = error.message;
				return;
			}
			fetchErrorMessage = 'Unable to load Fitbit data.';
		};

		try {
			try {
				activity = await fetchActivity();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit activity fetch error:', error);
				rememberError(error);
			}

			try {
				sleep = await fetchSleep();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit sleep fetch error:', error);
				rememberError(error);
			}

			try {
				heartRate = await fetchHeartRate();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit heart rate fetch error:', error);
				rememberError(error);
			}

			try {
				stepsWeek = await fetchStepsWeek();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit weekly steps fetch error:', error);
				rememberError(error);
			}

			try {
				floors = await fetchFloors();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit floors fetch error:', error);
				rememberError(error);
			}

			try {
				steps24h = await fetchStepsLast24h();
			} catch (error) {
				if (!tokenInvalid) console.error('Fitbit steps 24h fetch error:', error);
				rememberError(error);
			}

			const authError = tokenInvalid;
			const timestamp = nowSeconds();
			const hasUpdate =
				(activity && Object.values(activity).some((value) => value !== null && value !== undefined)) ||
				heartRate !== null ||
				stepsWeek !== null ||
				floors !== null ||
				steps24h !== null ||
				(sleep &&
					(sleep.sleepDurationMinutes !== null || sleep.sleepScore !== null));

			cache = {
				steps: steps24h ?? activity?.steps ?? previous.steps,
				distanceKm: activity?.distanceKm ?? previous.distanceKm,
				activeMinutes: activity?.activeMinutes ?? previous.activeMinutes,
				caloriesOut: activity?.caloriesOut ?? previous.caloriesOut,
				restingHeartRate: activity?.restingHeartRate ?? previous.restingHeartRate,
				sleepDurationMinutes: sleep?.sleepDurationMinutes ?? previous.sleepDurationMinutes,
				sleepScore: sleep?.sleepScore ?? previous.sleepScore,
					heartRateBpm: heartRate ?? previous.heartRateBpm,
					stepsWeek: stepsWeek ?? previous.stepsWeek,
					floors: floors ?? previous.floors,
					errorMessage: authError
						? 'Please refresh the Fitbit token on the site.'
						: fetchErrorMessage,
					lastUpdated: hasUpdate ? timestamp : previous.lastUpdated,
					nextRefresh: timestamp + MIN_REFRESH_SECONDS
				};

			return cache;
		} finally {
			inflight = null;
		}
	})();

	return inflight;
};
