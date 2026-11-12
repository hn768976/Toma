import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type ConnectorMaterials = {
	blackPlastic: THREE.Material;
	metal: THREE.Material;
	gold: THREE.Material;
	clear: THREE.Material;
	boot: THREE.Material;
	greyBoot: THREE.Material;
	insulator: THREE.Material;
	glow: THREE.Material;
	wires: THREE.Material[];
};

export const createConnectorMaterials = (
	bootColor: string,
	glowColor: string,
): ConnectorMaterials => ({
	blackPlastic: new THREE.MeshPhysicalMaterial({
		color: '#0a0c11',
		roughness: 0.32,
		metalness: 0.0,
		clearcoat: 0.8,
		clearcoatRoughness: 0.18,
		envMapIntensity: 1.3,
	}),
	metal: new THREE.MeshStandardMaterial({
		color: '#dfe5ee',
		metalness: 1.0,
		roughness: 0.2,
		envMapIntensity: 1.4,
	}),
	gold: new THREE.MeshStandardMaterial({
		color: '#e8b65a',
		metalness: 1.0,
		roughness: 0.25,
	}),
	clear: new THREE.MeshPhysicalMaterial({
		color: '#dbe9ff',
		metalness: 0,
		roughness: 0.06,
		clearcoat: 1,
		transparent: true,
		opacity: 0.3,
		depthWrite: false,
		side: THREE.DoubleSide,
		envMapIntensity: 2.2,
	}),
	boot: new THREE.MeshPhysicalMaterial({
		color: bootColor,
		roughness: 0.38,
		clearcoat: 0.4,
		envMapIntensity: 1.1,
	}),
	greyBoot: new THREE.MeshPhysicalMaterial({
		color: '#9aa3b2',
		roughness: 0.42,
		clearcoat: 0.3,
	}),
	insulator: new THREE.MeshStandardMaterial({color: '#050608', roughness: 0.6}),
	glow: new THREE.MeshBasicMaterial({
		color: new THREE.Color(glowColor).multiplyScalar(3),
		toneMapped: true,
	}),
	wires: ['#e8742a', '#f2f2f2', '#2fae4a', '#2f6fe0', '#f2f2f2', '#2fae4a', '#f2f2f2', '#7a4a2a'].map(
		(c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.4}),
	),
});

const stadium = (w: number, h: number) => {
	const r = h / 2;
	const s = new THREE.Shape();
	const x = w / 2 - r;
	s.moveTo(-x, -r);
	s.lineTo(x, -r);
	s.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
	s.lineTo(-x, r);
	s.absarc(-x, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
	return s;
};

const stadiumPath = (w: number, h: number) => {
	const r = h / 2;
	const p = new THREE.Path();
	const x = w / 2 - r;
	p.moveTo(-x, -r);
	p.lineTo(x, -r);
	p.absarc(x, 0, r, -Math.PI / 2, Math.PI / 2, false);
	p.lineTo(-x, r);
	p.absarc(-x, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
	return p;
};

/** Everything points along +Z; the tip is at z≈0 and the cable leaves along -Z. */
const strainRelief = (m: ConnectorMaterials, z: number, r0: number, r1: number) => {
	const geo = new THREE.CylinderGeometry(r0, r1, 0.7, 28, 1);
	geo.rotateX(Math.PI / 2);
	const mesh = new THREE.Mesh(geo, m.blackPlastic);
	mesh.position.z = z;
	return mesh;
};

export const makeUsbC = (m: ConnectorMaterials, glowing: boolean) => {
	const g = new THREE.Group();
	const body = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.38, 1.45, 5, 0.17), m.blackPlastic);
	body.position.z = -1.05;
	g.add(body);
	g.add(strainRelief(m, -2.05, 0.15, 0.2));
	const shellShape = stadium(0.56, 0.22);
	shellShape.holes.push(stadiumPath(0.48, 0.15));
	const shell = new THREE.Mesh(
		new THREE.ExtrudeGeometry(shellShape, {depth: 0.62, bevelEnabled: false, curveSegments: 16}),
		glowing ? m.glow : m.metal,
	);
	shell.position.z = -0.62;
	g.add(shell);
	const inner = new THREE.Mesh(
		new THREE.ExtrudeGeometry(stadium(0.48, 0.15), {depth: 0.5, bevelEnabled: false, curveSegments: 16}),
		m.insulator,
	);
	inner.position.z = -0.6;
	g.add(inner);
	const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.3), m.gold);
	tongue.position.z = -0.08;
	g.add(tongue);
	return g;
};

export const makeUsbA = (m: ConnectorMaterials) => {
	const g = new THREE.Group();
	const body = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.4, 1.5, 4, 0.12), m.blackPlastic);
	body.position.z = -1.35;
	g.add(body);
	g.add(strainRelief(m, -2.4, 0.15, 0.22));
	const shell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.72), m.metal);
	shell.position.z = -0.36;
	g.add(shell);
	const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.02), m.insulator);
	mouth.position.z = 0.0;
	g.add(mouth);
	const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.5), m.boot);
	tongue.position.set(0, 0.03, -0.24);
	g.add(tongue);
	return g;
};

export const makeRJ45 = (m: ConnectorMaterials, bootMat: THREE.Material) => {
	const g = new THREE.Group();
	const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.48, 0.95, 3, 0.04), m.clear);
	body.position.z = -0.47;
	g.add(body);
	for (let i = 0; i < 8; i++) {
		const x = -0.245 + i * 0.07;
		const c = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.32), m.gold);
		c.position.set(x, 0.17, -0.2);
		g.add(c);
		const fin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.05), m.clear);
		fin.position.set(x + 0.035, 0.18, -0.02);
		g.add(fin);
		const w = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.62, 10), m.wires[i]);
		w.rotation.x = Math.PI / 2;
		w.position.set(x, 0.03, -0.55);
		g.add(w);
	}
	const latch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.7), m.clear);
	latch.position.set(0, 0.29, -0.55);
	latch.rotation.x = -0.12;
	g.add(latch);
	const boot = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.54, 0.62, 4, 0.12), bootMat);
	boot.position.z = -1.22;
	g.add(boot);
	const bootTail = new THREE.CylinderGeometry(0.17, 0.27, 0.6, 24);
	bootTail.rotateX(Math.PI / 2);
	const tail = new THREE.Mesh(bootTail, bootMat);
	tail.position.z = -1.8;
	g.add(tail);
	return g;
};

export type ConnectorKind = 'usbc' | 'usbcGlow' | 'usba' | 'rj45Clear' | 'rj45Blue';

export const makeConnector = (kind: ConnectorKind, m: ConnectorMaterials) => {
	switch (kind) {
		case 'usbc':
			return makeUsbC(m, false);
		case 'usbcGlow':
			return makeUsbC(m, true);
		case 'usba':
			return makeUsbA(m);
		case 'rj45Clear':
			return makeRJ45(m, m.greyBoot);
		case 'rj45Blue':
			return makeRJ45(m, m.boot);
	}
};
