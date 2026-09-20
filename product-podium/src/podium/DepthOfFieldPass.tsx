/**
 * Depth of field, as a real render pass.
 *
 * This started life as a masked CSS `backdrop-filter` over the canvas,
 * which is exact for a locked camera and costs nothing per frame. It does
 * not work: Remotion's headless capture does not carry CSS paint effects
 * applied to or over a WebGL canvas. Measured, a 5.5x increase in blur
 * radius moved the wall's detail figure by 10%, and a plain `filter:
 * blur(20px)` wrapped round the canvas moved it by 8% — i.e. neither was
 * being applied at all. DOM overlays that merely paint (the grain, the
 * vignette) do survive; filters do not.
 *
 * So the blur happens in WebGL instead: the frame that was just drawn is
 * copied into a texture and redrawn through a variable-radius filter.
 *
 * It hooks the renderer rather than the render loop, and both of the
 * tidier routes were tried first. A `useFrame` at priority 1 takes over
 * the loop, and under @remotion/three that yields a frame with only the
 * top half written — a bare `gl.render` in that callback does it too, so
 * it is the takeover itself, not the pass. `addAfterEffect` never fires
 * at all here: Remotion advances the frame from inside the canvas before
 * a child's effect has subscribed, so the captured frame is drawn without
 * it. Wrapping `gl.render` works whoever triggers the draw, and is put
 * back on unmount.
 *
 * Because the camera is locked, the far field occupies a fixed region of
 * frame, so the radius can be a function of screen position alone — no
 * depth buffer needed, nothing sampled temporally, and nothing that could
 * differ between two render threads.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { DofConfig } from "./types";

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform vec2 uTexel;
/** Blur radius in pixels for each of the two far-field ramps. */
uniform vec2 uBlur;
/** Ramp A and ramp B as (top, bottom) in frame fractions, y down. */
uniform vec4 uRamps;
/** Sharp pocket: centre xy, radii xy. */
uniform vec4 uPocket;
uniform float uFeather;
uniform float uKeepMin;
uniform float uHasPocket;
/** (1,0) on the horizontal pass, (0,1) on the vertical one. */
uniform vec2 uDirection;
varying vec2 vUv;

float ramp( float y, float top, float bottom ) {
  return 1.0 - smoothstep( top, bottom, y );
}

void main() {
  // Frame coordinates with y measured from the top, which is how the look
  // data describes the ramps.
  vec2 f = vec2( vUv.x, 1.0 - vUv.y );

  float radius = uBlur.x * ramp( f.y, uRamps.x, uRamps.y )
               + uBlur.y * ramp( f.y, uRamps.z, uRamps.w );

  if ( uHasPocket > 0.5 ) {
    // The plinth stays sharp. The pocket is an ellipse with a feathered
    // edge so nothing shows a boundary.
    vec2 d = ( f - uPocket.xy ) / uPocket.zw;
    radius *= mix( uKeepMin, 1.0, smoothstep( 1.0 - uFeather, 1.0, length( d ) ) );
  }

  vec3 c;
  if ( radius < 0.6 ) {
    c = texture2D( uScene, vUv ).rgb;
  } else {
    // Separable Gaussian. A single disc of scattered taps cannot cover a
    // large radius without going sparse — at four times the radius it
    // stops looking like more blur and starts looking like noise — so the
    // blur runs as two 9-tap passes instead: 81 taps of coverage for 18
    // samples.
    //
    // Written out rather than looped over a weights array on purpose. Under
    // GLSL ES 1.00, which is what a ShaderMaterial compiles to here, an
    // array indexed by a loop variable is not guaranteed to compile, and
    // the name step is a GLSL built-in. Either one fails silently: three logs
    // the compile error, the quad draws nothing, and because this pass leaves
    // autoClear off the canvas simply keeps the unblurred frame — a dead
    // effect that looks exactly like an effect that is merely too weak.
    vec2 d1 = uDirection * uTexel * ( radius * 0.25 );
    vec2 d2 = d1 * 2.0;
    vec2 d3 = d1 * 3.0;
    vec2 d4 = d1 * 4.0;
    c  = texture2D( uScene, vUv ).rgb * 0.2270270;
    c += ( texture2D( uScene, vUv + d1 ).rgb + texture2D( uScene, vUv - d1 ).rgb ) * 0.1945946;
    c += ( texture2D( uScene, vUv + d2 ).rgb + texture2D( uScene, vUv - d2 ).rgb ) * 0.1216216;
    c += ( texture2D( uScene, vUv + d3 ).rgb + texture2D( uScene, vUv - d3 ).rgb ) * 0.0540540;
    c += ( texture2D( uScene, vUv + d4 ).rgb + texture2D( uScene, vUv - d4 ).rgb ) * 0.0162162;
  }

  // No colour conversion in either direction: what is sampled here is the
  // finished, tone-mapped, display-encoded frame, and it goes straight back
  // out. The blur therefore runs in display space, which is what the CSS
  // blur this replaces would have done anyway.
  gl_FragColor = vec4( c, 1.0 );
}
`;

export const DepthOfFieldPass: React.FC<{ dof: DofConfig | null }> = ({ dof }) => {
  const gl = useThree((s) => s.gl);
  // The drawing buffer, asked of the renderer rather than derived from the
  // CSS size and a dpr — Remotion's --scale changes devicePixelRatio, and
  // guessing it wrong sizes the target against the wrong viewport and
  // leaves most of the frame unwritten.
  const buffer = useMemo(() => new THREE.Vector2(), []);

  /**
   * The scene is redirected into this target and composited back out.
   *
   * A copy of the canvas, not a render target the scene is redirected
   * into. Redirecting looks tidier and is wrong here: three compiles
   * materials with NoToneMapping whenever they render into a target and
   * applies the real curve only on the way to the canvas, so the target
   * holds raw untone-mapped values and everything downstream has to
   * reimplement the renderer's tone mapping to get back to where it
   * started. Copying the finished frame avoids the whole problem.
   *
   * Sized lazily from the canvas's own backing store rather than from a
   * dpr guessed at mount: sized wrong, the copy is stretched on the way
   * back and softens the pocket that is supposed to stay sharp.
   */
  const scratchRef = useRef<THREE.FramebufferTexture | null>(null);
  const scratchFor = (w: number, h: number) => {
    const current = scratchRef.current;
    if (current && current.image.width === w && current.image.height === h) {
      return current;
    }
    current?.dispose();
    const t = new THREE.FramebufferTexture(w, h);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.colorSpace = THREE.NoColorSpace;
    scratchRef.current = t;
    return t;
  };

  /**
   * Holds the horizontal pass on its way to the vertical one, at quarter
   * resolution. Nine taps cannot cover a wide radius at full resolution —
   * at any useful blur the taps land twenty pixels apart and the result
   * ghosts rather than blurs. Dropping to a quarter between the two passes
   * makes them overlap, and the bilinear upsample on the way back smooths
   * what is left. Sample offsets stay in normalised UV either way, so they
   * mean the same fraction of the frame at both resolutions.
   */
  const midRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const midFor = (w: number, h: number) => {
    const current = midRef.current;
    if (current) {
      if (current.width !== w || current.height !== h) current.setSize(w, h);
      return current;
    }
    const t = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    t.texture.colorSpace = THREE.NoColorSpace;
    midRef.current = t;
    return t;
  };

  useEffect(
    () => () => {
      scratchRef.current?.dispose();
      scratchRef.current = null;
      midRef.current?.dispose();
      midRef.current = null;
    },
    [],
  );

  const { quadScene, quadCamera, material } = useMemo(() => {
    const uniforms = {
      uScene: { value: null as THREE.Texture | null },
      uTexel: { value: new THREE.Vector2() },
      uBlur: { value: new THREE.Vector2() },
      uRamps: { value: new THREE.Vector4() },
      uPocket: { value: new THREE.Vector4() },
      uFeather: { value: 0.4 },
      uKeepMin: { value: 0 },
      uHasPocket: { value: 0 },
      uDirection: { value: new THREE.Vector2(1, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const s = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    // The vertex shader writes clip space directly, so the bounding sphere
    // the culler tests says nothing useful about where this ends up. Left
    // culled, the pass silently does nothing and the frame comes out
    // looking exactly as if there were no depth of field at all.
    quad.frustumCulled = false;
    s.add(quad);
    return {
      quadScene: s,
      quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
      material: mat,
    };
  }, []);

  useEffect(() => () => {
    material.dispose();
    quadScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }, [material, quadScene]);

  useLayoutEffect(() => {
    if (!dof) return;
    const original = gl.render.bind(gl);
    let reentrant = false;

    const configure = (w: number, h: number, texture: THREE.Texture) => {
      const u = material.uniforms;
      u.uScene.value = texture;
      u.uTexel.value.set(1 / w, 1 / h);

      const layers = dof.layers ?? [];
      const a = layers[0];
      const b = layers[1];
      // Blur is authored as a fraction of frame height, so it scales with
      // whatever resolution the composition is rendered at.
      u.uBlur.value.set((a?.blur ?? 0) * h, (b?.blur ?? 0) * h);
      u.uRamps.value.set(a?.top ?? 0, a?.bottom ?? 0, b?.top ?? 0, b?.bottom ?? 0);

      if (dof.sharp) {
        u.uPocket.value.set(dof.sharp.cx, dof.sharp.cy, dof.sharp.rx, dof.sharp.ry);
        u.uFeather.value = dof.sharp.feather;
        u.uKeepMin.value = dof.sharp.keepMin;
        u.uHasPocket.value = 1;
      } else {
        u.uHasPocket.value = 0;
      }

    };

    gl.render = (renderScene: THREE.Object3D, renderCamera: THREE.Camera) => {
      // Anything not bound for the canvas — three's own transmission pass,
      // the shadow maps, this pass's own quad — goes straight through.
      if (reentrant || renderScene === quadScene || gl.getRenderTarget() !== null) {
        original(renderScene, renderCamera);
        return;
      }


      original(renderScene, renderCamera);

      const canvas = gl.domElement;
      const w = Math.max(1, canvas.width);
      const h = Math.max(1, canvas.height);
      const scratch = scratchFor(w, h);

      const mid = midFor(Math.max(1, w >> 2), Math.max(1, h >> 2));
      const u = material.uniforms;

      reentrant = true;
      try {
        gl.copyFramebufferToTexture(scratch);

        // Horizontal, into the intermediate.
        configure(w, h, scratch);
        u.uDirection.value.set(1, 0);
        gl.setRenderTarget(mid);
        original(quadScene, quadCamera);
        gl.setRenderTarget(null);

        // Vertical, back onto the canvas.
        configure(w, h, mid.texture);
        u.uDirection.value.set(0, 1);
        const autoClear = gl.autoClear;
        gl.autoClear = false;
        original(quadScene, quadCamera);
        gl.autoClear = autoClear;
      } finally {
        reentrant = false;
      }
    };

    return () => {
      gl.render = original;
    };
  }, [gl, material, quadScene, quadCamera, buffer, dof]);

  return null;
};
