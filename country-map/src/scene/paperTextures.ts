import * as THREE from 'three';
import { mulberry32, SEED_FIBRE } from '../rng';

let fibre: THREE.DataTexture | null = null;

/**
 * Tangent-space normal map of paper fibre: short random strands over fine
 * noise, built once per tab from a fixed seed.
 */
export const paperFibreNormalMap = () => {
	if (fibre) return fibre;
	const N = 1024;
	const h = new Float32Array(N * N);
	const rng = mulberry32(SEED_FIBRE);
	for (let i = 0; i < N * N; i++) h[i] = rng() * 0.35;
	for (let s = 0; s < 9000; s++) {
		const x0 = rng() * N;
		const y0 = rng() * N;
		const a = rng() * Math.PI;
		const len = 6 + rng() * 26;
		const amp = 0.4 + rng() * 0.6;
		for (let t = 0; t < len; t++) {
			const x = Math.floor(x0 + Math.cos(a) * t + N) % N;
			const y = Math.floor(y0 + Math.sin(a) * t + N) % N;
			h[y * N + x] += amp;
		}
	}
	// Soften one pass (wrap-around box blur) so strands are not single texels.
	const b = new Float32Array(N * N);
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			let acc = 0;
			for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) acc += h[((y + dy + N) % N) * N + ((x + dx + N) % N)];
			b[y * N + x] = acc / 9;
		}
	const data = new Uint8Array(N * N * 4);
	const strength = 0.9;
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			const dx = (b[y * N + ((x + 1) % N)] - b[y * N + ((x - 1 + N) % N)]) * strength;
			const dy = (b[((y + 1) % N) * N + x] - b[((y - 1 + N) % N) * N + x]) * strength;
			const n = new THREE.Vector3(-dx, -dy, 1).normalize();
			const i = (y * N + x) * 4;
			data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
			data[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
			data[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
			data[i + 3] = 255;
		}
	fibre = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
	fibre.wrapS = fibre.wrapT = THREE.RepeatWrapping;
	fibre.magFilter = THREE.LinearFilter;
	fibre.minFilter = THREE.LinearMipmapLinearFilter;
	fibre.generateMipmaps = true;
	fibre.needsUpdate = true;
	return fibre;
};
