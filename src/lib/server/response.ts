import { json } from '@sveltejs/kit';
import { getFitbitStats } from './fitbit';

const DEFAULT_HEADERS = {
	'access-control-allow-origin': '*',
	'cache-control': 'public, max-age=60, stale-while-revalidate=300'
};

export const createStatsResponse = async () =>
	json(await getFitbitStats(), {
		headers: DEFAULT_HEADERS
	});
