import fs from 'fs/promises';
import path from 'path';

export type ContributionDay = {
	date: string;
	color: string;
	count: number;
};

export type ContributionCalendar = {
	days: ContributionDay[];
	totalContributions: number;
};

type ContributionCacheEntry = { data: ContributionCalendar; timestamp: number };
type ContributionCacheFile = Record<string, ContributionCacheEntry>;

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const FALLBACK_ENDPOINT = 'https://github-contributions-api.jogruber.de/v4';
const CACHE_DURATION = 1000 * 60 * 30;
const STALE_CACHE_DURATION = 1000 * 60 * 60 * 24;
const REQUEST_TIMEOUT_MS = 3000;
const CONTRIBUTIONS_CACHE_FILE =
	process.env.CONTRIBUTIONS_CACHE_FILE ?? path.resolve('data/github-contributions-cache.json');

const levelColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const graphCache = new Map<string, ContributionCacheEntry>();
const fallbackCache = new Map<string, ContributionCacheEntry>();
const DEFAULT_GITHUB_OWNER = 'nickdev8';

const getOwner = (): string => (process.env.GITHUB_OWNER ?? process.env.VITE_GITHUB_OWNER ?? DEFAULT_GITHUB_OWNER).trim();
const getToken = (): string => (process.env.GITHUB_TOKEN ?? process.env.VITE_GITHUB_TOKEN ?? '').trim();

const formatISO = (value: string): string | undefined => {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const fetchWithTimeout = async (input: string, init?: RequestInit): Promise<Response> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
};

const normalizeGraphCalendar = (calendar: unknown): ContributionCalendar | null => {
	if (!calendar || typeof calendar !== 'object') return null;
	const record = calendar as {
		weeks?: { contributionDays?: { date?: string; color?: string; contributionCount?: number }[] }[];
		totalContributions?: number;
	};
	if (!Array.isArray(record.weeks)) return null;

	const days = record.weeks.flatMap((week) =>
		Array.isArray(week.contributionDays)
			? week.contributionDays
					.filter((day): day is { date: string; color?: string; contributionCount?: number } => typeof day.date === 'string')
					.map((day) => ({
						date: day.date,
						color: day.color || levelColors[0],
						count: day.contributionCount ?? 0
					}))
			: []
	);

	return {
		days,
		totalContributions: record.totalContributions ?? days.reduce((sum, day) => sum + day.count, 0)
	};
};

const readFileCache = async (): Promise<ContributionCacheFile> => {
	try {
		return JSON.parse(await fs.readFile(CONTRIBUTIONS_CACHE_FILE, 'utf8'));
	} catch {
		return {};
	}
};

const writeFileCacheEntry = async (cacheKey: string, entry: ContributionCacheEntry): Promise<void> => {
	try {
		const existing = await readFileCache();
		existing[cacheKey] = entry;
		await fs.mkdir(path.dirname(CONTRIBUTIONS_CACHE_FILE), { recursive: true });
		const tmp = `${CONTRIBUTIONS_CACHE_FILE}.tmp`;
		await fs.writeFile(tmp, JSON.stringify(existing), 'utf8');
		await fs.rename(tmp, CONTRIBUTIONS_CACHE_FILE);
	} catch (error) {
		console.error('Failed to persist contribution cache', error);
	}
};

const readStaleCacheEntry = async (cacheKey: string): Promise<ContributionCalendar | null> => {
	const entry = (await readFileCache())[cacheKey];
	if (!entry || Date.now() - entry.timestamp > STALE_CACHE_DURATION) return null;
	return entry.data;
};

const storeCacheEntry = async (
	cache: Map<string, ContributionCacheEntry>,
	cacheKey: string,
	data: ContributionCalendar
): Promise<void> => {
	const entry = { data, timestamp: Date.now() };
	cache.set(cacheKey, entry);
	await writeFileCacheEntry(cacheKey, entry);
};

const fetchGraphCalendar = async (from: string, to: string): Promise<ContributionCalendar | null> => {
	const owner = getOwner();
	const token = getToken();
	if (!owner || !token) return null;

	const cacheKey = `graph_${from}_${to}`;
	const cached = graphCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

	const query = `
		query($login: String!, $from: DateTime, $to: DateTime) {
			user(login: $login) {
				contributionsCollection(from: $from, to: $to) {
					contributionCalendar {
						weeks {
							contributionDays {
								date
								color
								contributionCount
							}
						}
						totalContributions
					}
				}
			}
		}
	`;

	const response = await fetchWithTimeout(GRAPHQL_ENDPOINT, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query,
			variables: { login: owner, from: formatISO(from), to: formatISO(to) }
		})
	});

	if (!response.ok) {
		console.error('Failed to fetch GitHub contribution calendar', response.status, await response.text());
		return null;
	}

	const json = await response.json();
	const normalized = normalizeGraphCalendar(json?.data?.user?.contributionsCollection?.contributionCalendar);
	if (normalized) await storeCacheEntry(graphCache, cacheKey, normalized);
	return normalized;
};

const fetchFallbackCalendar = async (from: string, to: string): Promise<ContributionCalendar | null> => {
	const owner = getOwner();
	if (!owner) return null;

	const cacheKey = `fallback_${from}_${to}`;
	const cached = fallbackCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

	const start = new Date(from);
	const end = new Date(to);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

	const requests = [];
	for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
		requests.push(fetchWithTimeout(`${FALLBACK_ENDPOINT}/${owner}?y=${year}`));
	}

	const days: ContributionDay[] = [];
	const responses = await Promise.allSettled(requests);
	for (const result of responses) {
		if (result.status !== 'fulfilled' || !result.value.ok) continue;

		const json = await result.value.json();
		for (const day of Array.isArray(json.contributions) ? json.contributions : []) {
			const dayDate = new Date(day.date);
			if (dayDate < start || dayDate > end) continue;
			const count = Number(day.count) || 0;
			const level = Math.min(Math.max(Number(day.level) || 0, 0), levelColors.length - 1);
			days.push({ date: day.date, count, color: levelColors[level] });
		}
	}

	if (!days.length) return null;

	const data = {
		days: days.sort((a, b) => a.date.localeCompare(b.date)),
		totalContributions: days.reduce((sum, day) => sum + day.count, 0)
	};
	await storeCacheEntry(fallbackCache, cacheKey, data);
	return data;
};

export const fetchContributionCalendar = async (range: {
	from: string;
	to: string;
}): Promise<ContributionCalendar | null> => {
	const graphCacheKey = `graph_${range.from}_${range.to}`;
	const fallbackCacheKey = `fallback_${range.from}_${range.to}`;

	try {
		const graph = await fetchGraphCalendar(range.from, range.to);
		if (graph) return graph;
	} catch (error) {
		console.error('Failed to fetch GitHub contribution graph', error);
	}

	try {
		const fallback = await fetchFallbackCalendar(range.from, range.to);
		if (fallback) return fallback;
	} catch (error) {
		console.error('Failed to fetch fallback GitHub contributions', error);
	}

	return (await readStaleCacheEntry(graphCacheKey)) || (await readStaleCacheEntry(fallbackCacheKey));
};
