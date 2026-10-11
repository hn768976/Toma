import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { LO_SPAN, NAME_UV } from '../map/drawMap';
import type { MapTextures } from '../map/drawMap';
import type { CountryRow } from '../rows';
import { CAMERA_FOV, DURATION, MAX_COC, shotAt } from './cameraPath';
import { paperFibreNormalMap } from './paperTextures';
import { paperFragment, paperVertex, postFragment, postVertex } from './shaders';

const HI_SIZE = 10; // world units covered by the hi-res texture
const GRAIN = 0.015;

/**
 * The paper sheet + post pass. Rendering happens in a priority-1 useFrame
 * callback, which @remotion/three invokes once per Remotion frame via
 * advance(); the callback reads only the Remotion frame (no R3F clock).
 */
export const AtlasScene: React.FC<{ row: CountryRow; maps: MapTextures }> = ({ row, maps }) => {
	const frame = useCurrentFrame();
	const frameRef = useRef(frame);
	frameRef.current = frame;
	const { gl } = useThree();

	const res = useMemo(() => {
		const maxAniso = gl.capabilities.getMaxAnisotropy();
		const mk = (canvas: HTMLCanvasElement) => {
			const t = new THREE.CanvasTexture(canvas);
			t.colorSpace = THREE.SRGBColorSpace;
			t.anisotropy = maxAniso;
			t.minFilter = THREE.LinearMipmapLinearFilter;
			t.magFilter = THREE.LinearFilter;
			t.generateMipmaps = true;
			t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
			// Upload now: the canvas is fully drawn before this component mounts.
			gl.initTexture(t);
			return t;
		};
		const hi = mk(maps.hi);
		const lo = mk(maps.lo);
		const fibre = paperFibreNormalMap();

		// Name at world origin; hi texture spans [-5,5] in x, and in z from
		// -NAME_UV.y*10 (far edge, top of the map) to (1-NAME_UV.y)*10.
		const hiOrigin = new THREE.Vector2(-NAME_UV[0] * HI_SIZE, -NAME_UV[1] * HI_SIZE);
		const hiCentre = hiOrigin.clone().addScalar(HI_SIZE / 2);
		const geo = new THREE.PlaneGeometry(HI_SIZE * LO_SPAN, HI_SIZE * LO_SPAN, 320, 320);
		geo.rotateX(-Math.PI / 2);
		geo.translate(hiCentre.x, 0, hiCentre.y);

		const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.5, 60);
		const paperMat = new THREE.ShaderMaterial({
			vertexShader: paperVertex,
			fragmentShader: paperFragment,
			uniforms: {
				uHi: { value: hi },
				uLo: { value: lo },
				uFibre: { value: fibre },
				uHiOrigin: { value: hiOrigin },
				uHiCentre: { value: hiCentre },
				uNameXZ: { value: new THREE.Vector2(0, 0) },
				uHiSize: { value: HI_SIZE },
				uLoSpan: { value: LO_SPAN },
				uBow: { value: HI_SIZE * 0.005 },
				uWave: { value: 0.004 },
				uCamPos: { value: new THREE.Vector3() },
				uKeyDir: { value: new THREE.Vector3(-0.55, 0.78, -0.35) },
				uKeyColour: { value: new THREE.Color(1.0, 0.985, 0.965).multiplyScalar(1.08) },
				uFillColour: { value: new THREE.Color(0.9, 0.95, 1.0).multiplyScalar(0.4) },
				uWindow: { value: new THREE.Vector2(-6, -9) },
			},
		});
		const scene = new THREE.Scene();
		scene.background = new THREE.Color('#5a4a3c'); // desk, should never be visible
		scene.add(new THREE.Mesh(geo, paperMat));

		const size = gl.getDrawingBufferSize(new THREE.Vector2());
		const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
			type: THREE.HalfFloatType,
			format: THREE.RGBAFormat,
			colorSpace: THREE.LinearSRGBColorSpace,
			minFilter: THREE.LinearMipmapLinearFilter,
			magFilter: THREE.LinearFilter,
			generateMipmaps: true,
			depthBuffer: true,
			samples: 4,
		});
		const postMat = new THREE.ShaderMaterial({
			vertexShader: postVertex,
			fragmentShader: postFragment,
			depthTest: false,
			depthWrite: false,
			uniforms: {
				uColour: { value: rt.texture },
				uRes: { value: size.clone() },
				uFocus: { value: 1 },
				uCocScale: { value: 0 },
				uMaxCoc: { value: MAX_COC },
				uFrame: { value: 0 },
				uGrain: { value: GRAIN },
			},
		});
		const postScene = new THREE.Scene();
		postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
		const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		return { hi, lo, geo, paperMat, postMat, scene, postScene, postCam, camera, rt };
	}, [gl, maps]);

	useEffect(
		() => () => {
			res.hi.dispose();
			res.lo.dispose();
			res.geo.dispose();
			res.paperMat.dispose();
			res.postMat.dispose();
			res.rt.dispose();
		},
		[res],
	);

	useFrame(() => {
		const f = frameRef.current;
		const shot = shotAt(row, f, res.camera);
		res.paperMat.uniforms.uCamPos.value.copy(shot.position);
		res.postMat.uniforms.uFocus.value = shot.focusDepth;
		res.postMat.uniforms.uCocScale.value = shot.cocScale;
		res.postMat.uniforms.uFrame.value = f % DURATION;
		gl.setRenderTarget(res.rt);
		gl.clear();
		gl.render(res.scene, res.camera);
		gl.setRenderTarget(null);
		gl.render(res.postScene, res.postCam);
	}, 1);

	return null;
};
