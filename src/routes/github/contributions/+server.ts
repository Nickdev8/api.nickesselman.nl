import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchContributionCalendar } from '$lib/server/githubContributions';

export const GET: RequestHandler = async ({ url }) => {
	const yearsParam = Number(url.searchParams.get('years'));
	const years = yearsParam === 2 ? 2 : 1;
	const today = new Date();
	const from = new Date(today);
	from.setUTCFullYear(from.getUTCFullYear() - years);
	from.setUTCDate(from.getUTCDate() + 1);

	try {
		const contributions = await fetchContributionCalendar({
			from: url.searchParams.get('from') || from.toISOString(),
			to: url.searchParams.get('to') || today.toISOString()
		});

		return json(
			{ contributions },
			{
				headers: {
					'access-control-allow-origin': '*',
					'cache-control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('Failed to fetch GitHub contributions via API:', error);
		return json({ error: 'Unable to fetch GitHub contributions right now.' }, { status: 502 });
	}
};
