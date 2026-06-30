import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchRecentGithubCommits } from '$lib/server/github';

export const GET: RequestHandler = async ({ url }) => {
	const limitParam = Number(url.searchParams.get('limit'));
	const limit = Number.isNaN(limitParam) ? 5 : Math.min(Math.max(limitParam, 1), 20);

	try {
		const commits = await fetchRecentGithubCommits(limit);
		return json(
			{ commits },
			{
				headers: {
					'access-control-allow-origin': '*',
					'cache-control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('Failed to fetch recent GitHub commits via API:', error);
		return json({ error: 'Unable to fetch GitHub commits right now.' }, { status: 502 });
	}
};
