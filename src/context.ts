import {createContext, useContext} from 'react';
import {Scene} from './lib/scene';
import {PanelSlot} from './lib/layout';
import {Variant} from './variants';

export type DashValue = {
	scene: Scene;
	variant: Variant;
	frame: number;
	duration: number;
	width: number;
	height: number;
	fontsReady: boolean;
	panels: PanelSlot[];
};

export const DashContext = createContext<DashValue | null>(null);

export const useDash = (): DashValue => {
	const value = useContext(DashContext);
	if (!value) {
		throw new Error('Dashboard components must be rendered inside <HalftoneDash>');
	}
	return value;
};
