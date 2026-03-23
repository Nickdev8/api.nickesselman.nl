import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	json(
		{
			service: 'api.nickesselman.nl',
			endpoints: ['/stats', '/fitbit', '/device-state']
		},
		{
			headers: {
				'access-control-allow-origin': '*',
				'cache-control': 'no-store'
			}
		}
	);
