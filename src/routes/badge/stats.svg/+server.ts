import type { RequestHandler } from './$types';
import { BADGE_HEADERS, createXpBadgeSvg } from '$lib/server/badge';

const formatUptime = (seconds: number): string => {
	const totalSeconds = Math.max(0, Math.floor(seconds));
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);

	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
};

export const GET: RequestHandler = async () =>
	new Response(
		createXpBadgeSvg({
			title: 'stats.exe',
			lines: ['API online', `Uptime: ${formatUptime(process.uptime())}`, 'api.nickesselman.nl'],
			accentColor: '#0055e5',
			iconType: 'stats'
		}),
		{
			headers: BADGE_HEADERS
		}
	);
