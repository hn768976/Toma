export type ServerPalette = {
	panel: string;
	frame: string;
	ledWhite: string;
	ledCyan: string;
	ledRed: string;
	ledAmber: string;
	ceilingLight: string;
	fog: string;
	floorTint: string;
	lift: [number, number, number];
	gain: [number, number, number];
};

/** Cold steel / cyan look of the reference data-centre aisle. */
export const DATA_CENTER_STEEL: ServerPalette = {
	panel: '#0a1820',
	frame: '#0e1a20',
	ledWhite: '#d2ecff',
	ledCyan: '#38e2f0',
	ledRed: '#ff3a32',
	ledAmber: '#ffb347',
	ceilingLight: '#e6f6ff',
	fog: '#03080b',
	floorTint: '#0a1418',
	lift: [0.0, 0.006, 0.01],
	gain: [0.95, 1.0, 1.04],
};
