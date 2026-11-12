import * as THREE from 'three';
import type {ServerPalette} from './palette';

/**
 * Procedural 42U rack fronts: servers, storage arrays, switches and blanking
 * panels with individually blinking status LEDs. Detail is band-limited with
 * screen-space derivatives so distant racks do not shimmer.
 */
export const RACK_W = 0.65;
export const RACK_H = 2.2;

export const createRackMaterial = (pal: ServerPalette, axis: 'z' | 'x', side: number) =>
	new THREE.ShaderMaterial({
		uniforms: {
			uTime: {value: 0},
			uCamZ: {value: 0},
			uGapStart: {value: 1e6},
			uSide: {value: side},
			uPanel: {value: new THREE.Color(pal.panel)},
			uFrame: {value: new THREE.Color(pal.frame)},
			uWhite: {value: new THREE.Color(pal.ledWhite)},
			uCyan: {value: new THREE.Color(pal.ledCyan)},
			uRed: {value: new THREE.Color(pal.ledRed)},
			uAmber: {value: new THREE.Color(pal.ledAmber)},
			uFog: {value: new THREE.Color(pal.fog)},
			uFogDensity: {value: 0.05},
			uBrightness: {value: 1},
		},
		vertexShader: /* glsl */ `
			varying vec3 vWorld;
			varying float vDepth;
			void main(){
				vec4 w = modelMatrix * vec4(position, 1.0);
				vWorld = w.xyz;
				vec4 mv = viewMatrix * w;
				vDepth = -mv.z;
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: /* glsl */ `
			precision highp float;
			uniform float uTime, uCamZ, uGapStart, uSide, uFogDensity, uBrightness;
			uniform vec3 uPanel, uFrame, uWhite, uCyan, uRed, uAmber, uFog;
			varying vec3 vWorld;
			varying float vDepth;
			const float RW = ${RACK_W.toFixed(3)};
			const float RH = ${RACK_H.toFixed(3)};

			float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
			float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

			// anti-aliased box mask: p in local units, half-size b, aa footprint w
			float boxMask(vec2 p, vec2 b, vec2 w){
				vec2 d = b - abs(p);
				vec2 m = clamp(d / max(w, 1e-5) + 0.5, 0.0, 1.0);
				return m.x * m.y;
			}

			// returns emissive LED colour of type sel (0 white,1 cyan,2 red,3 amber)
			vec3 ledColor(float sel){
				if (sel < 0.72) return uWhite;
				if (sel < 0.93) return uCyan;
				if (sel < 0.975) return uRed;
				return uAmber;
			}

			float blink(vec3 id, float rate){
				float ph = h3(id + 3.1) * 10.0;
				float k = floor(uTime * rate + ph);
				return step(0.3, h3(id + vec3(k, k * 0.37, 0.0)));
			}

			void main(){
				${axis === 'z' ? 'float s = vWorld.z * uSide;' : 'float s = vWorld.x;'}
				// cross-aisle opening near the far end (kept at fixed distance from camera)
				${axis === 'z' ? 'if (vWorld.z < uGapStart) discard;' : ''}
				float y = vWorld.y;
				float ri = floor(s / RW);
				float u = fract(s / RW);
				float v = y / RH;
				vec2 fw = vec2(fwidth(s / RW), fwidth(v));
				float rackSeed = h1(ri * 1.7 + uSide * 13.0 + ${axis === 'z' ? '0.0' : '91.0'});

				vec3 base = uPanel * (0.75 + 0.5 * rackSeed);
				vec3 emit = vec3(0.0);

				// rack frame & rails
				float inner = boxMask(vec2(u - 0.5, v - 0.5), vec2(0.43, 0.47), fw);
				base = mix(uFrame * 0.6, base, inner);
				// vertical rails with teal indicator dots
				float railL = boxMask(vec2(u - 0.075, v - 0.5), vec2(0.012, 0.46), fw);
				float railR = boxMask(vec2(u - 0.925, v - 0.5), vec2(0.012, 0.46), fw);
				float units = 42.0;
				float uv42 = (v - 0.03) / 0.94 * units;
				float ui = floor(uv42);
				float fu = fract(uv42);
				vec2 fwU = vec2(fw.x, fw.y / 0.94 * units);
				if (ui >= 0.0 && ui < units) {
					float dotOn = step(0.62, h3(vec3(ri, ui, 7.0 + uSide)));
					float dL = boxMask(vec2((u - 0.075) / 0.84 * 26.0, (fu - 0.5)), vec2(0.35, 0.18), fwU * vec2(26.0 / 0.84, 1.0));
					float dR = boxMask(vec2((u - 0.925) / 0.84 * 26.0, (fu - 0.5)), vec2(0.35, 0.18), fwU * vec2(26.0 / 0.84, 1.0));
					float rail = (dL + dR) * dotOn * blink(vec3(ri, ui, 2.0), 0.03);
					emit += rail * mix(uCyan, uRed, step(0.93, h3(vec3(ri, ui, 5.0)))) * 1.6;
				}
				base += (railL + railR) * 0.03;

				// devices
				if (inner > 0.0 && ui >= 0.0 && ui < units) {
					float lx = (u - 0.1) / 0.8; // 0..1 across the usable width
					float block = floor(ui / 2.0);
					float by = (uv42 - block * 2.0) / 2.0; // 0..1 within a 2U block
					float t = h3(vec3(ri, block, uSide * 3.0 + 1.0));
					// rack "personality": some racks are dense storage, some mostly blank
					t = fract(t + rackSeed * 0.35);
					vec2 fwB = vec2(fw.x / 0.8, fwU.y / 2.0);
					float occupied = step(0.06 + 0.2 * step(0.8, rackSeed) * step(0.5, h3(vec3(ri, block, 9.0))), h3(vec3(ri, block, 4.0)));
					if (occupied < 0.5) {
						// blanking panel / vent
						base *= 0.7;
						base += 0.015 * step(0.5, fract(lx * 40.0));
					} else if (t < 0.3) {
						// 2U server: 12 drive bays in 2 rows, status LEDs on the left
						float cols = 12.0;
						float bx = (lx - 0.18) / 0.8 * cols;
						float row = by < 0.5 ? 0.0 : 1.0;
						float fy = fract(by * 2.0);
						if (bx > 0.0 && bx < cols) {
							float ci = floor(bx);
							float fx = fract(bx);
							vec2 fwBay = vec2(fwB.x / 0.8 * cols, fwB.y * 2.0);
							float bay = boxMask(vec2(fx - 0.5, fy - 0.5), vec2(0.42, 0.36), fwBay);
							base += bay * vec3(0.022, 0.03, 0.036);
							vec3 id = vec3(ri * 31.0 + ci, block * 2.0 + row, uSide);
							float led = boxMask(vec2(fx - 0.82, fy - 0.5), vec2(0.07, 0.16), fwBay);
							float on = blink(id, 0.08 + 0.4 * h3(id + 1.0));
							emit += led * on * ledColor(h3(id + 5.0) * 0.8) * 4.2;
							// light bar on some bays (bright white strips as in the reference)
							float strip = boxMask(vec2(fx - 0.45, fy - 0.5), vec2(0.3, 0.06), fwBay);
							emit += strip * step(0.82, h3(id + 8.0)) * on * uWhite * 1.2;
						}
						float st = boxMask(vec2((lx - 0.06) * 20.0, by - 0.5), vec2(0.35, 0.12), vec2(fwB.x * 20.0, fwB.y));
						emit += st * ledColor(h3(vec3(ri, block, 11.0))) * 2.5 * blink(vec3(ri, block, 12.0), 0.05);
					} else if (t < 0.55) {
						// storage shelf: 24 vertical bays with bright activity LEDs
						float cols = 24.0;
						float bx = lx * cols;
						if (bx > 0.0 && bx < cols) {
							float ci = floor(bx);
							float fx = fract(bx);
							vec2 fwBay = vec2(fwB.x * cols, fwB.y);
							float bay = boxMask(vec2(fx - 0.5, by - 0.5), vec2(0.4, 0.42), fwBay);
							base += bay * vec3(0.02, 0.026, 0.032);
							vec3 id = vec3(ri * 57.0 + ci, block, uSide + 2.0);
							float led = boxMask(vec2(fx - 0.5, by - 0.2), vec2(0.22, 0.05), fwBay);
							float on = blink(id, 0.15 + 0.6 * h3(id + 2.0));
							emit += led * on * ledColor(h3(id + 6.0) * 0.9) * 4.5;
							float glow = boxMask(vec2(fx - 0.5, by - 0.6), vec2(0.3, 0.18), fwBay);
							emit += glow * step(0.72, h3(id + 9.0)) * uWhite * 1.1;
						}
					} else if (t < 0.76) {
						// dense status-LED matrix (the sparkly white clusters in the reference)
						float cols = 18.0;
						float rows = 4.0;
						vec2 g = vec2((lx - 0.04) / 0.92 * cols, by * rows);
						if (g.x > 0.0 && g.x < cols) {
							vec2 ci = floor(g);
							vec2 f = fract(g);
							vec2 fwG = vec2(fwB.x / 0.92 * cols, fwB.y * rows);
							vec3 id = vec3(ri * 89.0 + ci.x, block * 4.0 + ci.y, uSide + 8.0);
							float led = boxMask(f - 0.5, vec2(0.2, 0.17), fwG);
							float on = step(0.35, h3(id + 4.0)) * blink(id, 0.06 + 0.5 * h3(id + 7.0));
							emit += led * on * ledColor(h3(id + 2.0) * 0.85) * 4.5;
						}
					} else if (t < 0.9) {
						// switch: two rows of 24 ports, fast-flickering link LEDs
						float cols = 24.0;
						float bx = (lx - 0.05) / 0.9 * cols;
						float fy = fract(by * 2.0);
						float row = floor(by * 2.0);
						if (bx > 0.0 && bx < cols) {
							float ci = floor(bx);
							float fx = fract(bx);
							vec2 fwP = vec2(fwB.x / 0.9 * cols, fwB.y * 2.0);
							float port = boxMask(vec2(fx - 0.5, fy - 0.45), vec2(0.36, 0.3), fwP);
							base = mix(base, vec3(0.006), port);
							vec3 id = vec3(ri * 71.0 + ci, block * 2.0 + row, uSide + 4.0);
							float led = boxMask(vec2(fx - 0.25, fy - 0.85), vec2(0.1, 0.08), fwP);
							emit += led * blink(id, 0.5 + h3(id) * 0.8) * mix(uCyan, uWhite, step(0.6, h3(id + 3.0))) * 3.0;
						}
					} else {
						// 1U servers with a wide lit front bezel
						float fy = fract(by * 2.0);
						vec3 id = vec3(ri, block * 2.0 + floor(by * 2.0), uSide + 6.0);
						float bezel = boxMask(vec2(lx - 0.55, fy - 0.5), vec2(0.38, 0.12), vec2(fwB.x, fwB.y * 2.0));
						emit += bezel * uWhite * (0.3 + 0.8 * h3(id)) * blink(id, 0.02);
						float led = boxMask(vec2((lx - 0.08) * 30.0, fy - 0.5), vec2(0.4, 0.15), vec2(fwB.x * 30.0, fwB.y * 2.0));
						emit += led * ledColor(h3(id + 1.0)) * 3.0 * blink(id + 2.0, 0.1);
					}
				}

				// subtle glass-door sheen
				base += vec3(0.01, 0.018, 0.022) * smoothstep(0.2, 1.0, v) * (0.5 + 0.5 * sin(u * 3.1416));

				// band-limit: when a rack shrinks to a few pixels, fade to its average glow
				float detail = clamp(1.0 - (fw.x * 6.0 - 0.15), 0.0, 1.0);
				emit = mix(vec3(0.55, 0.62, 0.68) * 0.5 * inner, emit, detail);

				emit *= mix(1.35, 0.8, smoothstep(0.15, 0.85, v));
				vec3 col = base + emit * uBrightness;
				float fog = 1.0 - exp(-vDepth * uFogDensity);
				col = mix(col, uFog, fog);
				gl_FragColor = vec4(col, 1.0);
			}
		`,
		extensions: {derivatives: true} as never,
	});
