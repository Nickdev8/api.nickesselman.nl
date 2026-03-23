import { json, type RequestEvent } from '@sveltejs/kit';
import { getFitbitStats } from './fitbit';
import { checkRateLimit } from './rateLimit';

const DEFAULT_HEADERS = {
	'access-control-allow-origin': '*'
};

const buildCacheControl = (nextRefresh: number | null) => {
	if (!nextRefresh) {
		return 'public, max-age=60, stale-while-revalidate=120';
	}

	const secondsUntilRefresh = Math.max(30, nextRefresh - Math.floor(Date.now() / 1000));
	const maxAge = Math.max(60, Math.min(120, secondsUntilRefresh));
	const staleWhileRevalidate = Math.max(180, Math.min(600, secondsUntilRefresh * 2));
	return `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
};

export const createStatsResponse = async (event: RequestEvent) => {
	const rateLimit = checkRateLimit(event);
	if (!rateLimit.allowed) {
		return json(
			{
				errorMessage: 'Too many requests. Slow down and try again shortly.',
				retryAfterSeconds: rateLimit.retryAfterSeconds
			},
			{
				status: 429,
				headers: {
					...DEFAULT_HEADERS,
					...rateLimit.headers,
					'cache-control': 'no-store'
				}
			}
		);
	}

	const stats = await getFitbitStats();
	return json(stats, {
		headers: {
			...DEFAULT_HEADERS,
			...rateLimit.headers,
			'cache-control': 'no-store'
		}
	});
};
