import { addUpdatedLine, BADGE_HEADERS, createContributionBadgeSvg, createXpBadgeSvg } from './badge';
import { getFitbitStats } from './fitbit';
import { fetchRecentGithubCommits } from './github';
import { fetchContributionCalendar } from './githubContributions';
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

const formatRelativeTime = (dateValue: string): string => {
	const date = new Date(dateValue);
	const diffMs = Date.now() - date.getTime();
	if (Number.isNaN(diffMs)) return 'unknown time';

	const minutes = Math.max(0, Math.floor(diffMs / 60_000));
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

const commitTitle = (message: string): string => message.split('\n')[0]?.trim() || 'Commit';

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

export const createGithubCommitBadgeResponse = async (): Promise<Response> => {
	const commits = await fetchRecentGithubCommits(1);
	const latest = commits[0];
	const lines = addUpdatedLine(
		latest
			? [commitTitle(latest.commit.message), latest.repoName, `Pushed: ${formatRelativeTime(latest.commit.author.date)}`]
			: ['No recent commits found', 'GitHub feed unavailable']
	);

	return createSvgResponse(
		createXpBadgeSvg({
			title: 'github-latest.exe',
			lines,
			accentColor: '#24292f',
			iconType: 'github'
		})
	);
};

export const createGithubContributionsBadgeResponse = async (years: 1 | 2): Promise<Response> => {
	const today = new Date();
	const from = new Date(today);
	from.setUTCFullYear(from.getUTCFullYear() - years);
	from.setUTCDate(from.getUTCDate() + 1);
	const calendar = await fetchContributionCalendar({ from: from.toISOString(), to: today.toISOString() });

	if (!calendar) {
		return createGithubCommitBadgeResponse();
	}

	return createSvgResponse(
		createContributionBadgeSvg({
			title: `github-${years}y.exe`,
			days: calendar.days,
			total: calendar.totalContributions,
			years,
			to: today
		})
	);
};
