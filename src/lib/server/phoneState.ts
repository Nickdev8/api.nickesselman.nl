type StoredPhoneState = {
	receivedAtMs: number;
	payload: PhoneStatePayload;
};

export type PhoneStatePayload = {
	sentAt: string;
	batteryPercent: number | null;
	charging: boolean;
	volumePercent: number | null;
	mediaPlaying: boolean;
	screenOn: boolean;
	screenLocked: boolean;
};

export type PhoneStateStatus = {
	updatedAt: string | null;
	connected: boolean;
	status: string;
	sentAt: string | null;
	batteryPercent: number | null;
	charging: boolean;
	volumePercent: number | null;
	mediaPlaying: boolean;
	screenOn: boolean;
	screenLocked: boolean;
};

type PhoneStateListener = (status: PhoneStateStatus) => void;

const PHONE_STATE_STALE_SECONDS = Number.parseInt(process.env.PHONE_STATE_STALE_SECONDS ?? '90', 10);
const PHONE_STATE_STALE_MS =
	Number.isFinite(PHONE_STATE_STALE_SECONDS) && PHONE_STATE_STALE_SECONDS > 0
		? PHONE_STATE_STALE_SECONDS * 1000
		: 90_000;
const PHONE_STATE_TOKEN = (
	process.env.PHONE_STATE_TOKEN ??
	process.env.DEVICE_STATE_TOKEN ??
	''
).trim();

let latestPhoneState: StoredPhoneState | null = null;
const listeners = new Set<PhoneStateListener>();

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const parsePercent = (value: unknown): number | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded < 0 || rounded > 100) return null;
	return rounded;
};

const parseBoolean = (value: unknown, fallback = false): boolean => {
	if (typeof value === 'boolean') return value;
	return fallback;
};

const parseSentAt = (value: unknown): string => {
	if (typeof value !== 'string') return new Date().toISOString();
	const trimmed = value.trim();
	if (!trimmed) return new Date().toISOString();
	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) return new Date().toISOString();
	return new Date(parsed).toISOString();
};

export const parsePhoneStatePayload = (value: unknown): PhoneStatePayload | null => {
	const record = asRecord(value);
	if (!record) return null;

	return {
		sentAt: parseSentAt(record.sentAt),
		batteryPercent: parsePercent(record.batteryPercent),
		charging: parseBoolean(record.charging),
		volumePercent: parsePercent(record.volumePercent),
		mediaPlaying: parseBoolean(record.mediaPlaying),
		screenOn: parseBoolean(record.screenOn),
		screenLocked: parseBoolean(record.screenLocked)
	};
};

export const storePhoneState = (payload: PhoneStatePayload): void => {
	latestPhoneState = {
		receivedAtMs: Date.now(),
		payload
	};
	const snapshot = buildPhoneStateStatus();
	for (const listener of listeners) {
		listener(snapshot);
	}
};

export const buildPhoneStateStatus = (): PhoneStateStatus => {
	if (!latestPhoneState) {
		return {
			updatedAt: null,
			connected: false,
			status: 'no phone connected',
			sentAt: null,
			batteryPercent: null,
			charging: false,
			volumePercent: null,
			mediaPlaying: false,
			screenOn: false,
			screenLocked: false
		};
	}

	const ageMs = Date.now() - latestPhoneState.receivedAtMs;
	if (ageMs > PHONE_STATE_STALE_MS) {
		return {
			updatedAt: new Date(latestPhoneState.receivedAtMs).toISOString(),
			connected: false,
			status: 'no phone connected',
			sentAt: latestPhoneState.payload.sentAt,
			batteryPercent: null,
			charging: false,
			volumePercent: null,
			mediaPlaying: false,
			screenOn: false,
			screenLocked: false
		};
	}

	const payload = latestPhoneState.payload;
	return {
		updatedAt: new Date(latestPhoneState.receivedAtMs).toISOString(),
		connected: true,
		status: 'connected',
		sentAt: payload.sentAt,
		batteryPercent: payload.batteryPercent,
		charging: payload.charging,
		volumePercent: payload.volumePercent,
		mediaPlaying: payload.mediaPlaying,
		screenOn: payload.screenOn,
		screenLocked: payload.screenLocked
	};
};

export const subscribePhoneState = (listener: PhoneStateListener): (() => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

export const isPhoneStateAuthorized = (authorizationHeader: string | null): boolean => {
	if (!PHONE_STATE_TOKEN) return false;
	return authorizationHeader?.trim() === `Bearer ${PHONE_STATE_TOKEN}`;
};
