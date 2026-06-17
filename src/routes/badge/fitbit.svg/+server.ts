import type { RequestHandler } from './$types';
import { BADGE_HEADERS, createXpBadgeSvg } from '$lib/server/badge';
import { getFitbitStats } from '$lib/server/fitbit';

const formatNumber = (value: number | null): string | null =>
	value === null ? null : new Intl.NumberFormat('en-US').format(value);

export const GET: RequestHandler = async () => {
	const stats = await getFitbitStats();
	const steps = formatNumber(stats.steps);
	const heartRate = stats.heartRateBpm ?? stats.restingHeartRate;
	const thirdLine =
		stats.activeMinutes !== null
			? `Active: ${stats.activeMinutes} min`
			: stats.caloriesOut !== null
				? `Calories: ${formatNumber(stats.caloriesOut)}`
				: null;

	const lines =
		steps || heartRate !== null || thirdLine
			? [
					`Steps today: ${steps ?? 'unavailable'}`,
					`Heart rate: ${heartRate === null ? 'unavailable' : `${heartRate} bpm`}`,
					thirdLine ?? 'Fitbit synced'
				]
			: ['Fitbit data unavailable', 'Waiting for sync'];

	return new Response(
		createXpBadgeSvg({
			title: 'fitbit.exe',
			lines,
			accentColor: '#00b0b9',
			iconType: 'fitbit'
		}),
		{
			headers: BADGE_HEADERS
		}
	);
};
