import type { RequestHandler } from './$types';
import { beginSpotifyAuthorization } from '$lib/server/spotify';

export const GET: RequestHandler = async () => {
	try {
		const redirectUrl = beginSpotifyAuthorization();
		return new Response(null, {
			status: 302,
			headers: {
				location: redirectUrl,
				'access-control-allow-origin': '*',
				'cache-control': 'no-store'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown Spotify configuration error';
		return new Response(message, {
			status: 500,
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store',
				'content-type': 'text/plain; charset=utf-8'
			}
		});
	}
};
