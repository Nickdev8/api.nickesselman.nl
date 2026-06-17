import { addUpdatedLine, BADGE_HEADERS, createXpBadgeSvg } from './badge';
import { getFitbitStats } from './fitbit';
import { buildPhoneStateStatus } from './phoneState';
import { getSpotifyCurrentlyPlaying } from './spotify';

type SpotifyArtist = {
	name?: unknown;
};

type SpotifyItem = {
	name?: unknown;
	artists?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const createSvgResponse = (svg: string): Response =>
	new Response(svg, {
		headers: BADGE_HEADERS
	});

const getTrackLines = (data: unknown): string[] | null => {
	const record = asRecord(data);
	if (!record || record.is_playing !== true) return null;

	const item = asRecord(record.item) as SpotifyItem | null;
	const title = typeof item?.name === 'string' && item.name.trim() ? item.name : null;
	const artists = Array.isArray(item?.artists)
		? item.artists
				.map((artist: SpotifyArtist) => artist?.name)
				.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
		: [];

	if (!title) return null;

	return ['currently playing', title, artists.length ? artists.join(', ') : 'Unknown artist'];
};

const formatNumber = (value: number | null): string | null =>
	value === null ? null : new Intl.NumberFormat('en-US').format(value);

const formatUptime = (seconds: number): string => {
	const totalSeconds = Math.max(0, Math.floor(seconds));
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);

	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
};

export const createSpotifyBadgeResponse = async (): Promise<Response> => {
	const payload = await getSpotifyCurrentlyPlaying();
	const lines = addUpdatedLine(getTrackLines(payload.data) ?? ['Nothing playing', 'Spotify idle']);

	return createSvgResponse(
		createXpBadgeSvg({
			title: 'spotify.exe',
			lines,
			accentColor: '#1db954',
			iconType: 'spotify'
		})
	);
};

export const createPhoneBadgeResponse = async (): Promise<Response> => {
	const status = buildPhoneStateStatus();
	const lines = addUpdatedLine(
		status.connected
			? [
					`Battery: ${status.batteryPercent === null ? 'unknown' : `${status.batteryPercent}%`}`,
					`Charging: ${status.charging ? 'yes' : 'no'}`,
					`Screen: ${status.screenOn ? 'on' : 'off'}`
				]
			: ['Phone data unavailable', 'Waiting for update']
	);

	return createSvgResponse(
		createXpBadgeSvg({
			title: 'phone-state.exe',
			lines,
			accentColor: '#0055e5',
			iconType: 'phone'
		})
	);
};

export const createFitbitBadgeResponse = async (): Promise<Response> => {
	const stats = await getFitbitStats();
	const steps = formatNumber(stats.steps);
	const heartRate = stats.heartRateBpm ?? stats.restingHeartRate;
	const thirdLine =
		stats.activeMinutes !== null
			? `Active: ${stats.activeMinutes} min`
			: stats.caloriesOut !== null
				? `Calories: ${formatNumber(stats.caloriesOut)}`
				: null;

	const lines = addUpdatedLine(
		steps || heartRate !== null || thirdLine
			? [
					`Steps today: ${steps ?? 'unavailable'}`,
					`Heart rate: ${heartRate === null ? 'unavailable' : `${heartRate} bpm`}`,
					thirdLine ?? 'Fitbit synced'
				]
			: ['Fitbit data unavailable', 'Waiting for sync']
	);

	return createSvgResponse(
		createXpBadgeSvg({
			title: 'fitbit.exe',
			lines,
			accentColor: '#00b0b9',
			iconType: 'fitbit'
		})
	);
};

export const createStatsBadgeResponse = async (): Promise<Response> =>
	createSvgResponse(
		createXpBadgeSvg({
			title: 'stats.exe',
			lines: addUpdatedLine([
				'API online',
				`Uptime: ${formatUptime(process.uptime())}`,
				'api.nickesselman.nl'
			]),
			accentColor: '#0055e5',
			iconType: 'stats'
		})
	);
