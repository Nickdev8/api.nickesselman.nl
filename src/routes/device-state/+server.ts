import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	buildDeviceStateStatus,
	isDeviceStateAuthorized,
	parseDeviceStatePayload,
	storeDeviceState
} from '$lib/server/deviceState';

const DEFAULT_HEADERS = {
	'access-control-allow-origin': '*',
	'cache-control': 'no-store'
};

export const GET: RequestHandler = async () =>
	json(buildDeviceStateStatus(), {
		headers: DEFAULT_HEADERS
	});

export const POST: RequestHandler = async ({ request }) => {
	if (!isDeviceStateAuthorized(request.headers.get('authorization'))) {
		return json(
			{
				error: 'Unauthorized'
			},
			{
				status: 401,
				headers: DEFAULT_HEADERS
			}
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(
			{
				error: 'Invalid JSON body'
			},
			{
				status: 400,
				headers: DEFAULT_HEADERS
			}
		);
	}

	const payload = parseDeviceStatePayload(body);
	if (!payload) {
		return json(
			{
				error: 'Invalid payload shape'
			},
			{
				status: 400,
				headers: DEFAULT_HEADERS
			}
		);
	}

	storeDeviceState(payload);
	return json(
		{
			status: 'stored',
			receivedAt: new Date().toISOString()
		},
		{
			headers: DEFAULT_HEADERS
		}
	);
};
