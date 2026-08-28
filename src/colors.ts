export type Rgb = {r: number; g: number; b: number};

/** Parses `#RRGGBB`. All colour values originate in the THEME object. */
export const hexToRgb = (hex: string): Rgb => {
	const value = parseInt(hex.replace('#', ''), 16);
	return {
		r: (value >> 16) & 0xff,
		g: (value >> 8) & 0xff,
		b: value & 0xff,
	};
};

export const rgba = ({r, g, b}: Rgb, alpha: number): string =>
	`rgba(${r}, ${g}, ${b}, ${alpha})`;
