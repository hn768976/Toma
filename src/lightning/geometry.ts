import type {BoltConfig} from '../variants';
import {clamp, mix, rand, randIn, randIntIn, randSign} from './rng';

export interface ScreenPoint {
	x: number;
	y: number;
}

/**
 * Local generation space. `v` is distance travelled along the strike axis and
 * is always >= 0; `u` is lateral offset. The signed `strikeDirection` is applied
 * once, when local points are mapped to screen points, so reversing it inverts
 * the path, the branch angles and the stroke taper together.
 */
interface LocalPoint {
	u: number;
	v: number;
}

export interface BoltStroke {
	points: ScreenPoint[];
	/** Normalised travel at each point: 0 at the origin, 1 at the far tip. */
	travel: number[];
	/** 0 = main channel, 1 = fork, 2 = fork of a fork, ... */
	generation: number;
	/** Multiplier on every pass alpha — the brightness hierarchy. */
	brightness: number;
	/** Multiplier on every pass width. */
	width: number;
}

export interface Bolt {
	strokes: BoltStroke[];
	origin: ScreenPoint;
}

interface BranchSite {
	point: LocalPoint;
	/** Unit direction of the parent segment this site sits on. */
	dirU: number;
	dirV: number;
	/** Distance from the site to the end of the parent segment. */
	remaining: number;
	/** Seeded draw for the spawn decision. */
	draw: number;
	seed: string;
}

/**
 * Recursive midpoint displacement.
 *
 * Each call takes one segment, displaces its midpoint perpendicular to the
 * segment by a seeded amount, records the midpoint as a possible branch site,
 * then recurses on both halves with the amplitude halved. `out` accumulates the
 * resulting polyline; `a` must already be in it.
 */
const subdivide = (
	a: LocalPoint,
	b: LocalPoint,
	level: number,
	maxLevel: number,
	amp: number,
	falloff: number,
	seed: string,
	branchLevels: number,
	sites: BranchSite[],
	out: LocalPoint[],
): void => {
	if (level >= maxLevel) {
		out.push(b);
		return;
	}

	const du = b.u - a.u;
	const dv = b.v - a.v;
	const len = Math.hypot(du, dv) || 1;
	// Perpendicular unit vector of this segment.
	const perpU = -dv / len;
	const perpV = du / len;
	// Displacement is scaled to the segment's own length via `amp`, which is
	// halved at every level of the recursion.
	const offset = (rand(`${seed}:off`) * 2 - 1) * amp;
	const mid: LocalPoint = {
		u: (a.u + b.u) / 2 + perpU * offset,
		v: (a.v + b.v) / 2 + perpV * offset,
	};

	if (level < branchLevels) {
		sites.push({
			point: mid,
			dirU: du / len,
			dirV: dv / len,
			remaining: Math.hypot(b.u - mid.u, b.v - mid.v),
			draw: rand(`${seed}:branch`),
			seed: `${seed}:branch`,
		});
	}

	const next = amp * falloff;
	subdivide(a, mid, level + 1, maxLevel, next, falloff, `${seed}L`, branchLevels, sites, out);
	subdivide(mid, b, level + 1, maxLevel, next, falloff, `${seed}R`, branchLevels, sites, out);
};

/**
 * Runs the probability pass over the candidate sites, then trims or tops up the
 * result so the bolt lands inside the configured branch count.
 */
const pickSites = (
	sites: BranchSite[],
	seed: string,
	probability: number,
	bias: number,
	totalTravel: number,
	count: {min: number; max: number},
): BranchSite[] => {
	// Positive margin = the seeded draw came in under the local probability.
	const scored = sites.map((site) => {
		const t = clamp(site.point.v / totalTravel, 0, 1);
		// bias 0 spreads branches evenly, bias 1 pushes them towards the far tip.
		const local = probability * mix(1, 2 * t, bias);
		return {site, margin: local - site.draw};
	});
	scored.sort((a, b) => b.margin - a.margin);

	const spawned = scored.filter((s) => s.margin > 0).length;
	const target = clamp(
		spawned,
		Math.min(count.min, sites.length),
		Math.min(randIntIn(`${seed}:cap`, count), sites.length),
	);
	return scored.slice(0, target).map((s) => s.site);
};

interface BranchInput {
	from: LocalPoint;
	dirU: number;
	dirV: number;
	remaining: number;
	generation: number;
	seed: string;
}

export interface BoltInput {
	seed: string;
	cfg: BoltConfig;
	origin: ScreenPoint;
	/** Travel distance in canvas pixels. */
	travel: number;
	/** Lateral offset of the target point, in canvas pixels. */
	drift: number;
}

export const generateBolt = ({seed, cfg, origin, travel, drift}: BoltInput): Bolt => {
	const direction = cfg.strikeDirection;
	const toScreen = (p: LocalPoint): ScreenPoint => ({
		x: origin.x + p.u,
		// The one place the signed direction is applied.
		y: origin.y + p.v * direction,
	});
	const travelOf = (p: LocalPoint): number => clamp(p.v / travel, 0, 1);

	const strokes: BoltStroke[] = [];

	const build = (input: BranchInput): void => {
		const {from, dirU, dirV, remaining, generation, seed: branchSeed} = input;
		const maxLevel = Math.max(1, cfg.depth - generation);

		let end: LocalPoint;
		if (generation === 0) {
			end = {u: drift, v: travel};
		} else {
			const angle =
				randIn(`${branchSeed}:angle`, cfg.branchAngle) * randSign(`${branchSeed}:side`);
			const length = remaining * randIn(`${branchSeed}:len`, cfg.branchLength);
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			let rotU = dirU * cos - dirV * sin;
			let rotV = dirU * sin + dirV * cos;
			// A branch always keeps travelling in the parent's general direction.
			if (rotV < 0.15) {
				const norm = Math.hypot(rotU, 0.15) || 1;
				rotU = (rotU / norm) * Math.sqrt(Math.max(0, 1 - 0.15 * 0.15));
				rotV = 0.15;
			}
			end = {u: from.u + rotU * length, v: from.v + rotV * length};
		}

		const points: LocalPoint[] = [from];
		const sites: BranchSite[] = [];
		const amp = Math.hypot(end.u - from.u, end.v - from.v) * cfg.displacementScale;
		subdivide(
			from,
			end,
			0,
			maxLevel,
			amp,
			cfg.displacementFalloff,
			`${branchSeed}:path`,
			Math.max(0, cfg.branchLevels - generation),
			sites,
			points,
		);

		strokes.push({
			points: points.map(toScreen),
			travel: points.map(travelOf),
			generation,
			brightness: cfg.branchBrightnessFalloff ** generation,
			width: cfg.branchWidthFalloff ** generation,
		});

		if (generation >= cfg.branchDepth) {
			return;
		}

		const count = generation === 0 ? cfg.branchCount : cfg.subBranchCount;
		const probability =
			generation === 0 ? cfg.branchProbability : cfg.branchProbability * cfg.branchBrightnessFalloff;
		const chosen = pickSites(sites, branchSeed, probability, cfg.branchBias, travel, count);

		chosen.forEach((site, index) => {
			build({
				from: site.point,
				dirU: site.dirU,
				dirV: site.dirV,
				remaining: site.remaining,
				generation: generation + 1,
				seed: `${branchSeed}:b${index}`,
			});
		});
	};

	build({
		from: {u: 0, v: 0},
		dirU: 0,
		dirV: 1,
		remaining: travel,
		generation: 0,
		seed,
	});

	return {strokes, origin};
};

/** Generation is pure, so a module-level cache keyed by seed is safe and keeps
 * a flash's path identical for every frame it is lit. */
const cache = new Map<string, Bolt>();

export const getBolt = (input: BoltInput): Bolt => {
	const hit = cache.get(input.seed);
	if (hit) {
		return hit;
	}
	const bolt = generateBolt(input);
	cache.set(input.seed, bolt);
	return bolt;
};
