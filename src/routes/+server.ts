import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SPOTIFY_CONNECT_ENABLED } from '$env/static/private';

export const GET: RequestHandler = async () => {
	const endpoints: Record<string, { description: string }> = {
		'/': {
			description: 'This endpoint. Lists all available endpoints.'
		},
		'/stats': {
			description: 'Get general statistics about the service.'
		},
		'/fitbit': {
			description: 'Get current health/activity data from Fitbit.'
		},
		'/device-state': {
			description: 'Get or update the state of various home devices.'
		},
		'/phone-state': {
			description: 'Get the current state of the primary phone (battery, screen, media, etc.).'
		},
		'/phone-state/stream': {
			description: 'Server-Sent Events stream for real-time phone state updates.'
		},
		'/spotify/currently-playing': {
			description: 'Get the currently playing track on Spotify.'
		},
		'/badge/spotify.svg': {
			description: 'SVG image badge for the current Spotify status.'
		},
		'/badge/spotify/live.svg': {
			description: 'No-cache SVG image badge for the current Spotify status.'
		},
		'/badge/phone.svg': {
			description: 'SVG image badge for safe public phone status.'
		},
		'/badge/phone/live.svg': {
			description: 'No-cache SVG image badge for safe public phone status.'
		},
		'/badge/fitbit.svg': {
			description: 'SVG image badge for safe public Fitbit stats.'
		},
		'/badge/fitbit/live.svg': {
			description: 'No-cache SVG image badge for safe public Fitbit stats.'
		},
		'/badge/stats.svg': {
			description: 'SVG image badge for API status.'
		},
		'/badge/stats/live.svg': {
			description: 'No-cache SVG image badge for API status.'
		}
	};

	if (SPOTIFY_CONNECT_ENABLED === 'true') {
		endpoints['/spotify/connect'] = {
			description: 'Initiate Spotify OAuth flow (one-time setup).'
		};
		endpoints['/spotify/callback'] = {
			description: 'Spotify OAuth callback handler (one-time setup).'
		};
	}

	return json(
		{
			service: 'api.nickesselman.nl',
			endpoints
		},
		{
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store'
			}
		}
	);
};
