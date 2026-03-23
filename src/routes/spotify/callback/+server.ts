import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	SPOTIFY_CLIENT_ID,
	SPOTIFY_CLIENT_SECRET,
	SPOTIFY_CONNECT_ENABLED
} from '$env/static/private';
import { storeTokensFromCallback } from '$lib/server/spotify';

/**
 * Spotify OAuth callback.
 * NOTE: This is a one-time setup route. It should be locked down or removed after initial setup.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (SPOTIFY_CONNECT_ENABLED !== 'true') {
		return new Response(null, { status: 404 });
	}

	const code = url.searchParams.get('code');
	const errorParam = url.searchParams.get('error');

	if (errorParam) {
		return json({ error: `Spotify authorization failed: ${errorParam}` }, { status: 400 });
	}

	if (!code) {
		return json({ error: 'Missing code parameter' }, { status: 400 });
	}

	try {
		const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: 'https://api.nickesselman.nl/spotify/callback'
		});

		const response = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: body.toString()
		});

		const data = await response.json();

		if (!response.ok) {
			return json(
				{ error: data.error_description || data.error || 'Token exchange failed' },
				{ status: response.status }
			);
		}

		const { access_token, refresh_token, expires_in } = data;

		if (!access_token || !refresh_token) {
			return json({ error: 'Missing tokens in Spotify response' }, { status: 500 });
		}

		storeTokensFromCallback({
			accessToken: access_token,
			refreshToken: refresh_token,
			expiresIn: expires_in
		});

		return json(
			{
				success: true,
				message: 'Spotify refresh token stored successfully. You can now use /spotify/currently-playing.'
			},
			{
				headers: {
					'access-control-allow-origin': '*',
					'cache-control': 'no-store'
				}
			}
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error during token exchange';
		return json({ error: message }, { status: 500 });
	}
};
