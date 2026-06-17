import type { RequestHandler } from './$types';
import { BADGE_HEADERS, createXpBadgeSvg } from '$lib/server/badge';
import { getSpotifyCurrentlyPlaying } from '$lib/server/spotify';

type SpotifyArtist = {
	name?: unknown;
};

type SpotifyItem = {
	name?: unknown;
	artists?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

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

export const GET: RequestHandler = async () => {
	const payload = await getSpotifyCurrentlyPlaying();
	const lines = getTrackLines(payload.data) ?? ['Nothing playing', 'Spotify idle'];

	return new Response(
		createXpBadgeSvg({
			title: 'spotify.exe',
			lines,
			accentColor: '#1db954',
			iconType: 'spotify'
		}),
		{
			headers: BADGE_HEADERS
		}
	);
};
