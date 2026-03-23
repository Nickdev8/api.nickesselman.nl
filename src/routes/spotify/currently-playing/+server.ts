import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSpotifyCurrentlyPlaying } from '$lib/server/spotify';

const DEFAULT_HEADERS = {
	'access-control-allow-origin': '*',
	'cache-control': 'no-store'
};

export const GET: RequestHandler = async () => {
	const payload = await getSpotifyCurrentlyPlaying();
	return json(payload, {
		headers: DEFAULT_HEADERS
	});
};
