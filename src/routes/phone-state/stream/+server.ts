import type { RequestHandler } from './$types';
import { buildPhoneStateStatus, subscribePhoneState } from '$lib/server/phoneState';

const STREAM_HEADERS = {
	'access-control-allow-origin': '*',
	'cache-control': 'no-cache, no-store, must-revalidate',
	connection: 'keep-alive',
	'content-type': 'text/event-stream'
};

export const GET: RequestHandler = async ({ request }) => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			const send = (event: string, payload: unknown) => {
				if (closed) return;
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
			};

			send('state', buildPhoneStateStatus());
			const unsubscribe = subscribePhoneState((status) => {
				send('state', status);
			});

			const heartbeat = setInterval(() => {
				if (closed) return;
				controller.enqueue(encoder.encode(': keep-alive\n\n'));
			}, 15_000);

			const close = () => {
				if (closed) return;
				closed = true;
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// ignore stream close races
				}
			};

			request.signal.addEventListener('abort', close);
		}
	});

	return new Response(stream, {
		headers: STREAM_HEADERS
	});
};
