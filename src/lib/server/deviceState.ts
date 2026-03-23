type DeviceNodePayload = {
	volumePercent: number | null;
	batteryPercent: number | null;
	charging: boolean | null;
};

type LaptopPayload = DeviceNodePayload & {
	locked: boolean | null;
};

type PhonePayload = DeviceNodePayload & {
	connected: boolean;
};

export type DeviceStatePayload = {
	sentAt: string;
	laptop: LaptopPayload;
	phone: PhonePayload;
};

export type DeviceStateStatus = {
	updatedAt: string | null;
	laptop: LaptopPayload & {
		connected: boolean;
		status: string;
	};
	phone: DeviceNodePayload & {
		connected: boolean;
		status: string;
	};
};

type StoredDeviceState = {
	receivedAtMs: number;
	payload: DeviceStatePayload;
};

const STALE_SECONDS = Number.parseInt(process.env.DEVICE_STATE_STALE_SECONDS ?? '45', 10);
const STALE_MS = Number.isFinite(STALE_SECONDS) && STALE_SECONDS > 0 ? STALE_SECONDS * 1000 : 45_000;
const DEVICE_STATE_TOKEN = (process.env.DEVICE_STATE_TOKEN ?? '').trim();

let latestState: StoredDeviceState | null = null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const parsePercent = (value: unknown): number | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded < 0 || rounded > 100) return null;
	return rounded;
};

const parseBooleanOrNull = (value: unknown): boolean | null => {
	if (value === null || value === undefined) return null;
	if (typeof value === 'boolean') return value;
	return null;
};

const parseNode = (value: unknown): DeviceNodePayload | null => {
	const record = asRecord(value);
	if (!record) return null;

	return {
		volumePercent: parsePercent(record.volumePercent),
		batteryPercent: parsePercent(record.batteryPercent),
		charging: parseBooleanOrNull(record.charging)
	};
};

const parseLaptop = (value: unknown): LaptopPayload | null => {
	const node = parseNode(value);
	const record = asRecord(value);
	if (!node || !record) return null;
	return {
		...node,
		locked: parseBooleanOrNull(record.locked)
	};
};

const parsePhone = (value: unknown): PhonePayload | null => {
	const node = parseNode(value);
	const record = asRecord(value);
	if (!node || !record) return null;
	return {
		...node,
		connected: record.connected === true
	};
};

const parseSentAt = (value: unknown): string => {
	if (typeof value !== 'string') return new Date().toISOString();
	const trimmed = value.trim();
	if (!trimmed) return new Date().toISOString();
	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) return new Date().toISOString();
	return new Date(parsed).toISOString();
};

export const parseDeviceStatePayload = (value: unknown): DeviceStatePayload | null => {
	const record = asRecord(value);
	if (!record) return null;

	const laptop = parseLaptop(record.laptop);
	const phone = parsePhone(record.phone);
	if (!laptop || !phone) return null;

	return {
		sentAt: parseSentAt(record.sentAt),
		laptop,
		phone
	};
};

export const storeDeviceState = (payload: DeviceStatePayload): void => {
	latestState = {
		receivedAtMs: Date.now(),
		payload
	};
};

export const isDeviceStateAuthorized = (authorizationHeader: string | null): boolean => {
	if (!DEVICE_STATE_TOKEN) return false;
	return authorizationHeader?.trim() === `Bearer ${DEVICE_STATE_TOKEN}`;
};

export const buildDeviceStateStatus = (): DeviceStateStatus => {
	if (!latestState) {
		return {
			updatedAt: null,
			laptop: {
				connected: false,
				status: 'no laptop connected',
				volumePercent: null,
				batteryPercent: null,
				charging: null,
				locked: null
			},
			phone: {
				connected: false,
				status: 'no phone connected',
				volumePercent: null,
				batteryPercent: null,
				charging: null
			}
		};
	}

	const ageMs = Date.now() - latestState.receivedAtMs;
	if (ageMs > STALE_MS) {
		return {
			updatedAt: new Date(latestState.receivedAtMs).toISOString(),
			laptop: {
				connected: false,
				status: 'no laptop connected',
				volumePercent: null,
				batteryPercent: null,
				charging: null,
				locked: null
			},
			phone: {
				connected: false,
				status: 'no phone connected',
				volumePercent: null,
				batteryPercent: null,
				charging: null
			}
		};
	}

	const payload = latestState.payload;
	const phoneConnected = payload.phone.connected;
	return {
		updatedAt: new Date(latestState.receivedAtMs).toISOString(),
		laptop: {
			connected: true,
			status: 'connected',
			volumePercent: payload.laptop.volumePercent,
			batteryPercent: payload.laptop.batteryPercent,
			charging: payload.laptop.charging,
			locked: payload.laptop.locked
		},
		phone: {
			connected: phoneConnected,
			status: phoneConnected ? 'connected' : 'no phone connected',
			volumePercent: phoneConnected ? payload.phone.volumePercent : null,
			batteryPercent: phoneConnected ? payload.phone.batteryPercent : null,
			charging: phoneConnected ? payload.phone.charging : null
		}
	};
};
