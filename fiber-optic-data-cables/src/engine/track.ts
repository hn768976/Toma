import * as THREE from 'three';

/** `hold` forces zero velocity at the key (camera settles there). */
export type Key = {t: number; v: THREE.Vector3; hold?: boolean};

/**
 * C1-continuous cubic Hermite interpolation through time-stamped keys
 * (non-uniform Catmull-Rom tangents, zero velocity at the first/last key).
 */
export const sampleTrack = (keys: Key[], t: number, out = new THREE.Vector3()) => {
	if (t <= keys[0].t) return out.copy(keys[0].v);
	const last = keys[keys.length - 1];
	if (t >= last.t) return out.copy(last.v);
	let i = 0;
	while (i < keys.length - 2 && t > keys[i + 1].t) i++;
	const k0 = keys[i];
	const k1 = keys[i + 1];
	const dt = k1.t - k0.t;
	const tangent = (j: number) => {
		if (j <= 0 || j >= keys.length - 1 || keys[j].hold) return new THREE.Vector3();
		const a = keys[j - 1];
		const b = keys[j + 1];
		return b.v.clone().sub(a.v).divideScalar(b.t - a.t);
	};
	const m0 = tangent(i).multiplyScalar(dt);
	const m1 = tangent(i + 1).multiplyScalar(dt);
	const s = (t - k0.t) / dt;
	const s2 = s * s;
	const s3 = s2 * s;
	const h00 = 2 * s3 - 3 * s2 + 1;
	const h10 = s3 - 2 * s2 + s;
	const h01 = -2 * s3 + 3 * s2;
	const h11 = s3 - s2;
	return out
		.copy(k0.v)
		.multiplyScalar(h00)
		.addScaledVector(m0, h10)
		.addScaledVector(k1.v, h01)
		.addScaledVector(m1, h11);
};

export const sampleScalar = (keys: {t: number; v: number; hold?: boolean}[], t: number) =>
	sampleTrack(
		keys.map((k) => ({t: k.t, v: new THREE.Vector3(k.v, 0, 0), hold: k.hold})),
		t,
	).x;
