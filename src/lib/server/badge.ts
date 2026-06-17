export type XpBadgeIconType = 'spotify' | 'phone' | 'fitbit' | 'stats' | 'info';

type XpBadgeOptions = {
	title: string;
	lines: string[];
	accentColor?: string;
	iconType?: XpBadgeIconType;
	width?: number;
	height?: number;
};

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 90;
const XP_BLUE = '#0055e5';

export const BADGE_HEADERS = {
	'content-type': 'image/svg+xml; charset=utf-8',
	'cache-control': 'public, max-age=30'
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
	const safeLines = lines.slice(0, 3).map((line) => escapeXml(trimLine(line)));
	const bodyY = [43, 60, 76];

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
				`<text x="62" y="${bodyY[index]}" fill="${index === 0 ? '#111111' : '#333333'}" font-family="Tahoma, Arial, sans-serif" font-size="${index === 0 ? 14 : 13}" font-weight="${index === 0 ? 'bold' : 'normal'}">${line}</text>`
		)
		.join('\n\t')}
</svg>
`;
};
