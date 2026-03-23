import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	json(
		{
			service: 'api.nickesselman.nl',
			endpoints: {
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
					description: 'Get the current state of the primary phone (battery, location, etc.).'
				},
				'/phone-state/stream': {
					description: 'Server-Sent Events stream for real-time phone state updates.'
				},
				'/spotify/currently-playing': {
					description: 'Get the currently playing track on Spotify.'
				},
				'/spotify/connect': {
					description: 'Initiate Spotify OAuth flow (one-time setup).'
				},
				'/spotify/callback': {
					description: 'Spotify OAuth callback handler (one-time setup).'
				}
			}
		},
		{
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store'
			}
		}
	);
