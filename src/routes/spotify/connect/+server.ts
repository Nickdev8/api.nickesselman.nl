import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CONNECT_ENABLED } from '$env/static/private';

/**
 * Spotify OAuth entry point.
 * NOTE: This is a one-time setup route. It should be locked down or removed after initial setup.
 */
export const GET: RequestHandler = async () => {
	if (SPOTIFY_CONNECT_ENABLED !== 'true') {
		return new Response(null, { status: 404 });
	}

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: SPOTIFY_CLIENT_ID,
		scope: 'user-read-currently-playing',
		redirect_uri: 'https://api.nickesselman.nl/spotify/callback',
		state: crypto.randomUUID()
	});

	throw redirect(302, `https://accounts.spotify.com/authorize?${params.toString()}`);
};
