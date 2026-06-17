import type { RequestHandler } from './$types';
import { BADGE_HEADERS, createXpBadgeSvg } from '$lib/server/badge';
import { buildPhoneStateStatus } from '$lib/server/phoneState';

export const GET: RequestHandler = async () => {
	const status = buildPhoneStateStatus();
	const lines = status.connected
		? [
				`Battery: ${status.batteryPercent === null ? 'unknown' : `${status.batteryPercent}%`}`,
				`Charging: ${status.charging ? 'yes' : 'no'}`,
				`Screen: ${status.screenOn ? 'on' : 'off'}`
			]
		: ['Phone data unavailable', 'Waiting for update'];

	return new Response(
		createXpBadgeSvg({
			title: 'phone-state.exe',
			lines,
			accentColor: '#0055e5',
			iconType: 'phone'
		}),
		{
			headers: BADGE_HEADERS
		}
	);
};
