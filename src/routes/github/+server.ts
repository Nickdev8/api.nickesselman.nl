import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchRecentGithubCommits } from '$lib/server/github';
import { fetchContributionCalendar } from '$lib/server/githubContributions';

const parseLimit = (value: string | null): number => {
	const parsed = Number(value);
	return Number.isNaN(parsed) ? 5 : Math.min(Math.max(parsed, 1), 20);
};

const parseYears = (value: string | null): number => {
	const parsed = Number(value);
	return parsed === 2 ? 2 : 1;
};

export const GET: RequestHandler = async ({ url }) => {
	const today = new Date();
	const from = new Date(today);
	from.setUTCFullYear(from.getUTCFullYear() - parseYears(url.searchParams.get('years')));
	from.setUTCDate(from.getUTCDate() + 1);

	try {
		const [contributions, commits] = await Promise.all([
			fetchContributionCalendar({
				from: url.searchParams.get('from') || from.toISOString(),
				to: url.searchParams.get('to') || today.toISOString()
			}),
			fetchRecentGithubCommits(parseLimit(url.searchParams.get('limit')))
		]);

		return json(
			{ contributions, commits },
			{
				headers: {
					'access-control-allow-origin': '*',
					'cache-control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('Failed to fetch GitHub activity via API:', error);
		return json({ error: 'Unable to fetch GitHub activity right now.' }, { status: 502 });
	}
};
