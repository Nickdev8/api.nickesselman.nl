export type XpBadgeIconType = 'spotify' | 'phone' | 'fitbit' | 'stats' | 'github' | 'info';

type XpBadgeOptions = {
	title: string;
	lines: string[];
	accentColor?: string;
	iconType?: XpBadgeIconType;
	width?: number;
	height?: number;
};

type ContributionBadgeDay = {
	date: string;
	color: string;
	count: number;
};

type ContributionBadgeOptions = {
	title: string;
	days: ContributionBadgeDay[];
	total: number;
	years: 1 | 2;
	to?: Date;
};

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 90;
const XP_BLUE = '#0055e5';

export const BADGE_HEADERS = {
	'content-type': 'image/svg+xml; charset=utf-8',
	'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
	pragma: 'no-cache',
	expires: '0',
	'surrogate-control': 'no-store',
	'x-accel-expires': '0'
};

export const escapeXml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

const safeAccentColor = (value: string | undefined): string =>
	value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : XP_BLUE;

const trimLine = (value: string): string => {
	const compact = value.replace(/\s+/g, ' ').trim();
	return compact.length > 52 ? `${compact.slice(0, 49)}...` : compact;
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number): Date => {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
};

const startOfUtcDay = (date: Date): Date =>
	new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const weeksBetween = (start: Date, end: Date): number =>
	Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / 604_800_000);

export const formatAmsterdamBadgeTime = (date = new Date()): string =>
	new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Amsterdam',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).format(date);

export const addUpdatedLine = (lines: string[], date = new Date()): string[] => [
	...lines.slice(0, 3),
	`Updated: ${formatAmsterdamBadgeTime(date)}`
];

const iconSvg = (type: XpBadgeIconType, accentColor: string): string => {
	switch (type) {
		case 'spotify':
			return `
				<circle cx="30" cy="53" r="18" fill="${accentColor}" stroke="#0b6b2c" stroke-width="2"/>
				<path d="M19 47c8-3 17-2 24 2" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
				<path d="M21 54c6-2 14-1 20 2" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
				<path d="M23 60c5-1 10 0 15 2" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
			`;
		case 'phone':
			return `
				<rect x="18" y="35" width="24" height="36" rx="3" fill="#2d2d2d" stroke="#000000" stroke-width="2"/>
				<rect x="21" y="40" width="18" height="24" fill="#a7d8ff" stroke="#ffffff" stroke-width="1"/>
				<circle cx="30" cy="68" r="1.8" fill="#d9d9d9"/>
				<rect x="25" y="36" width="10" height="2" fill="#777777"/>
			`;
		case 'fitbit':
			return `
				<circle cx="30" cy="53" r="18" fill="#ffffff" stroke="${accentColor}" stroke-width="2"/>
				<circle cx="24" cy="47" r="3" fill="${accentColor}"/>
				<circle cx="31" cy="47" r="3" fill="${accentColor}"/>
				<circle cx="38" cy="47" r="3" fill="${accentColor}"/>
				<circle cx="27" cy="54" r="3" fill="${accentColor}"/>
				<circle cx="34" cy="54" r="3" fill="${accentColor}"/>
				<circle cx="31" cy="61" r="3" fill="${accentColor}"/>
			`;
		case 'stats':
			return `
				<rect x="15" y="36" width="30" height="30" fill="#ffffff" stroke="#4b4b4b" stroke-width="2"/>
				<rect x="21" y="55" width="4" height="7" fill="${accentColor}"/>
				<rect x="28" y="49" width="4" height="13" fill="${accentColor}"/>
				<rect x="35" y="43" width="4" height="19" fill="${accentColor}"/>
				<path d="M20 48l7-5 7 3 6-7" fill="none" stroke="#d40000" stroke-width="2"/>
			`;
		case 'github':
			return `
				<circle cx="30" cy="53" r="18" fill="#24292f" stroke="#000000" stroke-width="2"/>
				<path d="M30 38c-8.1 0-14.7 6.6-14.7 14.7 0 6.5 4.2 12 10.1 13.9.7.1 1-.3 1-.7v-2.6c-4.1.9-5-1.8-5-1.8-.7-1.7-1.6-2.1-1.6-2.1-1.3-.9.1-.9.1-.9 1.5.1 2.2 1.5 2.2 1.5 1.3 2.2 3.4 1.6 4.2 1.2.1-.9.5-1.6.9-1.9-3.3-.4-6.7-1.6-6.7-7.3 0-1.6.6-2.9 1.5-4-.1-.4-.7-1.9.1-3.9 0 0 1.2-.4 4 1.5 1.2-.3 2.4-.5 3.7-.5s2.5.2 3.7.5c2.8-1.9 4-1.5 4-1.5.8 2 .3 3.5.1 3.9.9 1.1 1.5 2.4 1.5 4 0 5.7-3.4 6.9-6.7 7.3.5.5 1 1.4 1 2.8v3.8c0 .4.3.9 1 .7 5.9-2 10.1-7.5 10.1-13.9C44.7 44.6 38.1 38 30 38z" fill="#ffffff"/>
			`;
		case 'info':
		default:
			return `
				<circle cx="30" cy="53" r="18" fill="#ffffff" stroke="${accentColor}" stroke-width="2"/>
				<rect x="28" y="50" width="4" height="13" fill="${accentColor}"/>
				<rect x="28" y="42" width="4" height="4" fill="${accentColor}"/>
			`;
	}
};

export const createXpBadgeSvg = ({
	title,
	lines,
	accentColor,
	iconType = 'info',
	width = DEFAULT_WIDTH,
	height = DEFAULT_HEIGHT
}: XpBadgeOptions): string => {
	const color = safeAccentColor(accentColor);
	const escapedTitle = escapeXml(trimLine(title));
	const safeLines = lines.slice(0, 4).map((line) => escapeXml(trimLine(line)));
	const bodyY = [42, 55, 68, 79];

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapedTitle}">
	<rect x="0" y="0" width="${width}" height="${height}" fill="#ece9d8"/>
	<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#ffffff"/>
	<rect x="2.5" y="2.5" width="${width - 5}" height="${height - 5}" fill="none" stroke="#808080"/>
	<rect x="4" y="4" width="${width - 8}" height="22" fill="${color}"/>
	<text x="10" y="19" fill="#ffffff" font-family="Tahoma, Arial, sans-serif" font-size="13" font-weight="bold">${escapedTitle}</text>
	<rect x="${width - 66}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<path d="M${width - 62} 18h8" stroke="#000000" stroke-width="2"/>
	<rect x="${width - 46}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<rect x="${width - 42}" y="11" width="8" height="7" fill="none" stroke="#000000"/>
	<rect x="${width - 26}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<path d="M${width - 22} 11l8 8M${width - 14} 11l-8 8" stroke="#000000" stroke-width="2"/>
	<rect x="8" y="31" width="${width - 16}" height="${height - 39}" fill="#f8f7ef" stroke="#aca899"/>
	${iconSvg(iconType, color)}
	${safeLines
		.map(
			(line, index) =>
				`<text x="62" y="${bodyY[index]}" fill="${index === 0 ? '#111111' : '#333333'}" font-family="Tahoma, Arial, sans-serif" font-size="${index === 0 ? 13 : 12}" font-weight="${index === 0 ? 'bold' : 'normal'}">${line}</text>`
		)
		.join('\n\t')}
</svg>
`;
};

export const createContributionBadgeSvg = ({
	title,
	days,
	total,
	years,
	to = new Date()
}: ContributionBadgeOptions): string => {
	const today = startOfUtcDay(to);
	const from = new Date(today);
	from.setUTCFullYear(from.getUTCFullYear() - years);
	from.setUTCDate(from.getUTCDate() + 1);

	const firstColumnStart = addUtcDays(from, -from.getUTCDay());
	const lastColumnStart = addUtcDays(today, -today.getUTCDay());
	const columns = weeksBetween(firstColumnStart, lastColumnStart) + 1;
	const cell = years === 1 ? 6 : 5;
	const gap = 2;
	const gridX = 18;
	const gridY = 44;
	const gridWidth = columns * cell + (columns - 1) * gap;
	const gridHeight = 7 * cell + 6 * gap;
	const width = gridX * 2 + gridWidth;
	const height = 112;
	const escapedTitle = escapeXml(title);
	const dayMap = new Map(days.map((day) => [day.date, day]));
	const safeTotal = new Intl.NumberFormat('en-US').format(total);
	const rangeLabel = `${years} year${years === 1 ? '' : 's'} through ${isoDate(today)}`;
	const cells: string[] = [];

	for (let cursor = new Date(firstColumnStart); cursor <= today; cursor = addUtcDays(cursor, 1)) {
		if (cursor < from) continue;
		const date = isoDate(cursor);
		const day = dayMap.get(date);
		const column = weeksBetween(firstColumnStart, cursor);
		const row = cursor.getUTCDay();
		const x = gridX + column * (cell + gap);
		const y = gridY + row * (cell + gap);
		const color = day?.color && /^#[0-9a-fA-F]{6}$/.test(day.color) ? day.color : '#ebedf0';
		const count = day?.count ?? 0;
		cells.push(
			`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1" fill="${color}"><title>${escapeXml(
				`${date}: ${count} contribution${count === 1 ? '' : 's'}`
			)}</title></rect>`
		);
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapedTitle}">
	<rect x="0" y="0" width="${width}" height="${height}" fill="#ece9d8"/>
	<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#ffffff"/>
	<rect x="2.5" y="2.5" width="${width - 5}" height="${height - 5}" fill="none" stroke="#808080"/>
	<rect x="4" y="4" width="${width - 8}" height="22" fill="#24292f"/>
	<text x="10" y="19" fill="#ffffff" font-family="Tahoma, Arial, sans-serif" font-size="13" font-weight="bold">${escapedTitle}</text>
	<rect x="${width - 66}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<path d="M${width - 62} 18h8" stroke="#000000" stroke-width="2"/>
	<rect x="${width - 46}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<rect x="${width - 42}" y="11" width="8" height="7" fill="none" stroke="#000000"/>
	<rect x="${width - 26}" y="7" width="16" height="16" fill="#d4d0c8" stroke="#ffffff"/>
	<path d="M${width - 22} 11l8 8M${width - 14} 11l-8 8" stroke="#000000" stroke-width="2"/>
	<text x="${gridX}" y="37" fill="#111111" font-family="Tahoma, Arial, sans-serif" font-size="12" font-weight="bold">${safeTotal} contributions</text>
	<text x="${width - gridX}" y="37" text-anchor="end" fill="#333333" font-family="Tahoma, Arial, sans-serif" font-size="12">${escapeXml(rangeLabel)}</text>
	<rect x="${gridX - 5}" y="${gridY - 5}" width="${gridWidth + 10}" height="${gridHeight + 10}" fill="#f8f7ef" stroke="#aca899"/>
	${cells.join('\n\t')}
</svg>
`;
};
