import type { RequestEvent } from '@sveltejs/kit';

type ClientBucket = {
	timestamps: number[];
};

type WindowRule = {
	windowMs: number;
	limit: number;
};

export type RateLimitDecision = {
	allowed: boolean;
	headers: Record<string, string>;
	retryAfterSeconds: number | null;
};

const WINDOW_RULES: WindowRule[] = [
	{ windowMs: 60_000, limit: 180 },
	{ windowMs: 10 * 60_000, limit: 900 }
];

const MAX_WINDOW_MS = Math.max(...WINDOW_RULES.map((rule) => rule.windowMs));
const RATE_LIMIT_POLICY = WINDOW_RULES.map(
	(rule) => `${rule.limit};w=${Math.round(rule.windowMs / 1000)}`
).join(', ');

const buckets = new Map<string, ClientBucket>();

const normalizeIp = (value: string | null) => {
	if (!value) return 'unknown';

	const trimmed = value.trim();
	if (!trimmed) return 'unknown';

	if (trimmed.startsWith('::ffff:')) {
		return trimmed.slice(7);
	}

	return trimmed;
};

const getClientIp = (event: RequestEvent) => {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		return normalizeIp(forwarded.split(',')[0] ?? null);
	}

	try {
		return normalizeIp(event.getClientAddress());
	} catch {
		return 'unknown';
	}
};

const isPrivateIpv4 = (ip: string) => {
	if (/^127\./.test(ip)) return true;
	if (/^10\./.test(ip)) return true;
	if (/^192\.168\./.test(ip)) return true;

	const match = ip.match(/^172\.(\d{1,3})\./);
	if (!match) return false;

	const segment = Number.parseInt(match[1], 10);
	return Number.isInteger(segment) && segment >= 16 && segment <= 31;
};

const isTrustedClient = (ip: string) => {
	if (ip === 'unknown') return false;
	if (ip === '::1' || ip === 'localhost') return true;
	if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
	if (ip.startsWith('fe80:')) return true;
	return isPrivateIpv4(ip);
};

const pruneBucket = (bucket: ClientBucket, now: number) => {
	bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < MAX_WINDOW_MS);
};

const buildHeaders = (remaining: number, resetSeconds: number) => ({
	'x-ratelimit-policy': RATE_LIMIT_POLICY,
	'x-ratelimit-limit': String(WINDOW_RULES[0].limit),
	'x-ratelimit-remaining': String(Math.max(0, remaining)),
	'x-ratelimit-reset': String(Math.max(1, resetSeconds))
});

export const checkRateLimit = (event: RequestEvent): RateLimitDecision => {
	const ip = getClientIp(event);

	if (isTrustedClient(ip)) {
		return {
			allowed: true,
			headers: {
				'x-ratelimit-policy': `${RATE_LIMIT_POLICY}; trusted`
			},
			retryAfterSeconds: null
		};
	}

	const now = Date.now();
	const bucket = buckets.get(ip) ?? { timestamps: [] };
	pruneBucket(bucket, now);

	let retryAfterSeconds = 0;
	for (const rule of WINDOW_RULES) {
		const recent = bucket.timestamps.filter((timestamp) => now - timestamp < rule.windowMs);
		if (recent.length >= rule.limit) {
			const oldest = recent[0];
			const retryAfterMs = oldest + rule.windowMs - now;
			retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(retryAfterMs / 1000));
		}
	}

	if (retryAfterSeconds > 0) {
		if (bucket.timestamps.length > 0) {
			buckets.set(ip, bucket);
		}

		const shortWindowCount = bucket.timestamps.filter(
			(timestamp) => now - timestamp < WINDOW_RULES[0].windowMs
		).length;

		return {
			allowed: false,
			headers: {
				...buildHeaders(WINDOW_RULES[0].limit - shortWindowCount, retryAfterSeconds),
				'retry-after': String(retryAfterSeconds)
			},
			retryAfterSeconds
		};
	}

	bucket.timestamps.push(now);
	pruneBucket(bucket, now);
	buckets.set(ip, bucket);

	const remaining = Math.min(
		...WINDOW_RULES.map((rule) => {
			const recent = bucket.timestamps.filter((timestamp) => now - timestamp < rule.windowMs);
			return rule.limit - recent.length;
		})
	);
	const resetSeconds = Math.min(
		...WINDOW_RULES.map((rule) => {
			const recent = bucket.timestamps.filter((timestamp) => now - timestamp < rule.windowMs);
			if (recent.length === 0) return Math.ceil(rule.windowMs / 1000);
			return Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000));
		})
	);

	return {
		allowed: true,
		headers: buildHeaders(remaining, resetSeconds),
		retryAfterSeconds: null
	};
};
