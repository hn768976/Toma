import * as THREE from 'three';
import type {Rng} from '../engine/random';
import type {ConnectorKind} from './connectors';
import type {StrandSpec} from './strands';

/**
 * Cable layout.
 *
 * Every black cable (hero connectors and background cables) is a straight line that
 * passes through one shared source point – the bundle's vanishing point. Straight
 * lines through a common point can never cross each other in any perspective view,
 * so the cables fan out from the vanishing point like the reference instead of
 * criss-crossing. On top of that, every cable and connector is tested as a
 * screen-space capsule against all others from the closing camera positions, and
 * background cables that would overlap anything are rejected.
 */

export type HeroDef = {
	kind: ConnectorKind;
	/**
	 * Tip position on screen in the final camera, as polar coordinates around the
	 * bundle's vanishing point: angle in degrees (0 = right, 90 = up) and distance in
	 * NDC-y units. Laying heroes out by angle is what keeps them from overlapping –
	 * each one owns its own angular slot and no other cable runs through it.
	 */
	ang: number;
	rad: number;
	/** tip distance in front of the final camera */
	d: number;
	scale: number;
	delay: number;
	twist: number;
};

export const HERO_DEFS: HeroDef[] = [
	{kind: 'rj45Clear', ang: 27, rad: 1.5, d: 6.0, scale: 2.1, delay: 132, twist: 0.1},
	{kind: 'usbc', ang: 8, rad: 2.6, d: 7.5, scale: 1.5, delay: 135, twist: 0.3},
	{kind: 'rj45Blue', ang: -2, rad: 2.9, d: 8, scale: 1.4, delay: 137, twist: 0.0},
	{kind: 'usbc', ang: 52, rad: 2.4, d: 7.0, scale: 1.3, delay: 131, twist: 0.4},
	{kind: 'usbc', ang: -14, rad: 1.3, d: 10, scale: 1.0, delay: 138, twist: 0.6},
	{kind: 'usbcGlow', ang: 66, rad: 0.75, d: 20, scale: 1.0, delay: 138, twist: 0.3},
	{kind: 'usbcGlow', ang: 80, rad: 1.0, d: 16, scale: 1.0, delay: 140, twist: 0.4},
	{kind: 'rj45Clear', ang: 94, rad: 0.9, d: 24, scale: 1.0, delay: 136, twist: 0.0},
	{kind: 'usba', ang: 110, rad: 1.47, d: 13, scale: 1.0, delay: 130, twist: 0.2},
	{kind: 'usbcGlow', ang: -167, rad: 0.24, d: 9, scale: 1.1, delay: 138, twist: 1.2},
];

export type HeroLayout = {spec: StrandSpec; up: THREE.Vector3; plugLen: number; def: HeroDef};
export type BgCableLayout = {spec: StrandSpec; radius: number};

type Capsule = {a: THREE.Vector3; b: THREE.Vector3; ra: number; rb: number};
type Shape = {name: string; caps: Capsule[]};
type Pt = {x: number; y: number; r: number};

const CABLE_R = 0.16; // hero cable radius per unit connector scale
const CONNECTOR_R = 0.4; // connector half-width per unit scale
const PLUG_LEN = 2.35; // connector length per unit scale
const KEEP_OUT = 0.45; // screen radius (NDC-y units) around the vanishing point where the bundle converges
const MARGIN = 0.014; // minimum visible gap between shapes (NDC-y units, ≈ 7 px at 1080p)

const makeProjector = (cam: THREE.PerspectiveCamera, aspect: number, source: THREE.Vector3) => {
	const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
	const inv = cam.matrixWorldInverse;
	const c = new THREE.Vector3();
	const n = new THREE.Vector3();
	const vpN = source.clone().project(cam);
	const vp = {x: vpN.x * aspect, y: vpN.y};
	const toScreen = (p: THREE.Vector3, worldR: number): Pt | null => {
		c.copy(p).applyMatrix4(inv);
		if (c.z > -0.25) return null; // behind / at the lens
		n.copy(p).project(cam);
		return {x: n.x * aspect, y: n.y, r: worldR / (-c.z * tanV)};
	};
	const sample = (s: Shape) => {
		const pts: Pt[] = [];
		for (const cap of s.caps) {
			const len = cap.a.distanceTo(cap.b);
			const steps = Math.max(8, Math.ceil(len * 3));
			for (let i = 0; i <= steps; i++) {
				const u = i / steps;
				const p = toScreen(cap.a.clone().lerp(cap.b, u), THREE.MathUtils.lerp(cap.ra, cap.rb, u));
				if (!p) continue;
				if (Math.hypot(p.x - vp.x, p.y - vp.y) < KEEP_OUT) continue;
				// only what is on (or just off) screen matters
				if (Math.abs(p.x) > aspect + p.r + 0.1 || Math.abs(p.y) > 1 + p.r + 0.1) continue;
				pts.push(p);
			}
		}
		return pts;
	};
	return sample;
};

const clash = (A: Pt[], B: Pt[]) => {
	for (const p of A)
		for (const q of B) {
			const lim = p.r + q.r + MARGIN;
			const dx = p.x - q.x;
			if (dx > lim || dx < -lim) continue;
			const dy = p.y - q.y;
			if (dx * dx + dy * dy < lim * lim) return true;
		}
	return false;
};

export const layoutCables = (opts: {
	rng: Rng;
	source: THREE.Vector3;
	/** the camera the heroes are staged in (closing frame) */
	stageCam: THREE.PerspectiveCamera;
	/** cameras from which nothing may overlap (e.g. settle frame and last frame) */
	checkCams: THREE.PerspectiveCamera[];
	aspect: number;
	settle: number;
	bgCount: number;
}) => {
	const {rng, source, stageCam, aspect} = opts;
	const tanV = Math.tan(THREE.MathUtils.degToRad(stageCam.fov / 2));
	const tanH = tanV * aspect;
	const camQ = stageCam.quaternion.clone();
	const camNdc = (sx: number, sy: number, depth: number) =>
		new THREE.Vector3(sx * tanH * depth, sy * tanV * depth, -depth).applyMatrix4(stageCam.matrixWorld);
	const camLocal = (x: number, y: number, z: number) =>
		new THREE.Vector3(x, y, z).applyMatrix4(stageCam.matrixWorld);
	const camDir = (x: number, y: number, z: number) =>
		new THREE.Vector3(x, y, z).normalize().applyQuaternion(camQ);
	const samplers = opts.checkCams.map((c) => makeProjector(c, aspect, source));
	const sampleAll = (s: Shape) => samplers.map((f) => f(s));

	/** straight cable through the source: starts a little way out along its own ray */
	const straightSpec = (end: THREE.Vector3, delay: number, duration: number): StrandSpec => {
		const dir = end.clone().sub(source).normalize();
		const p0 = source.clone().addScaledVector(dir, rng.range(0.5, 3.5));
		return {
			p0,
			p1: p0.clone().lerp(end, 1 / 3),
			p2: p0.clone().lerp(end, 2 / 3),
			p3: end,
			delay,
			duration,
			width: 0,
			bright: 0,
			seed: rng.next(),
		};
	};

	const placed: {name: string; pts: Pt[][]}[] = [];
	const conflicts: string[] = [];
	const fits = (pts: Pt[][]) => placed.every((o) => pts.every((p, i) => !clash(p, o.pts[i])));

	const heroes: HeroLayout[] = [];
	const vpN = source.clone().project(stageCam);
	HERO_DEFS.forEach((h, idx) => {
		const a = THREE.MathUtils.degToRad(h.ang);
		const tip = camNdc(vpN.x + (h.rad * Math.cos(a)) / aspect, vpN.y + h.rad * Math.sin(a), h.d);
		const dir = tip.clone().sub(source).normalize();
		const plugLen = PLUG_LEN * h.scale;
		const end = tip.clone().addScaledVector(dir, -plugLen);
		const spec = straightSpec(end, h.delay, opts.settle - 4 - h.delay + rng.range(-3, 2));
		const shape: Shape = {
			name: `hero${idx}:${h.kind}`,
			caps: [
				{a: spec.p0, b: end, ra: CABLE_R * h.scale, rb: CABLE_R * h.scale},
				{a: end, b: tip, ra: CONNECTOR_R * h.scale, rb: CONNECTOR_R * h.scale},
			],
		};
		const pts = sampleAll(shape);
		for (const o of placed)
			pts.forEach((p, i) => {
				if (clash(p, o.pts[i])) conflicts.push(`${shape.name} × ${o.name} (check camera ${i})`);
			});
		placed.push({name: shape.name, pts});
		const up = camDir(Math.sin(h.twist), Math.cos(h.twist), 0);
		heroes.push({spec, up, plugLen, def: h});
	});

	// background cables that sweep out past the edges of frame, fanning from the source
	const bg: BgCableLayout[] = [];
	let tries = 0;
	while (bg.length < opts.bgCount && tries < 4000) {
		tries++;
		const upperLeft = rng.next() < 0.6;
		const phi = THREE.MathUtils.degToRad(upperLeft ? rng.range(92, 158) : rng.range(18, 80));
		const r = rng.range(4.5, 10);
		const end = camLocal(r * Math.cos(phi), r * Math.sin(phi), rng.range(-3, 6));
		const radius = rng.range(0.09, 0.17);
		const delay = rng.range(124, 148);
		const duration = rng.range(30, 42);
		const spec = straightSpec(end, delay, duration);
		const pts = sampleAll({name: 'bg', caps: [{a: spec.p0, b: end, ra: radius, rb: radius}]});
		if (!fits(pts)) continue;
		placed.push({name: `bg${bg.length}`, pts});
		bg.push({spec, radius});
	}
	return {heroes, bg, conflicts};
};
