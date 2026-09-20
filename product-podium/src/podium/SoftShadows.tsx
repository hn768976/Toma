/**
 * Contact-hardening soft shadows (PCSS).
 *
 * Deliberately NOT `<AccumulativeShadows>`: that builds its result over
 * successive frames, and Remotion renders frames out of order across
 * threads, so it flickers. This is a per-frame shader technique — every
 * frame is computed from scratch and is identical no matter which thread
 * draws it.
 *
 * drei's own `<SoftShadows>` is written against an older three: it patches
 * the first `#if defined( SHADOWMAP_TYPE_PCF )` in the chunk, which in
 * three 0.182 is a uniform declaration rather than the body of `getShadow`,
 * and it still unpacks RGBA-encoded depth, which three no longer writes.
 * So the chunk is patched here instead, against the shader that actually
 * ships, and the patch throws if it fails to find its anchor rather than
 * silently leaving you with hard shadows.
 *
 * The blocker search gives the penumbra its width from the distance between
 * occluder and receiver, which is the whole reason the foliage gobo reads as
 * real: sharp where a leaf is close to the wall, soft where it is far.
 */
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";

export type SoftShadowsProps = {
  /** Apparent size of the light source. Larger = softer, faster-growing penumbra. */
  size?: number;
  /** Blocker-search taps. */
  blockerSamples?: number;
  /** Penumbra filter taps. */
  filterSamples?: number;
  /** Minimum penumbra, so a contact shadow is never a single hard pixel. */
  minRadius?: number;
};

const glsl = (o: Required<SoftShadowsProps>) => `
#define PODIUM_LIGHT_SIZE float(${o.size.toFixed(4)})
#define PODIUM_MIN_RADIUS float(${o.minRadius.toFixed(5)})
#define PODIUM_BLOCKER_SAMPLES ${o.blockerSamples}
#define PODIUM_FILTER_SAMPLES ${o.filterSamples}

vec2 podiumVogel( const in int i, const in int count, const in float phi ) {
  float r = sqrt( ( float( i ) + 0.5 ) / float( count ) );
  float theta = float( i ) * 2.399963229728653 + phi;
  return vec2( cos( theta ), sin( theta ) ) * r;
}

// Per-pixel, frame-independent dither. The camera is locked, so a given
// screen pixel keeps the same sample rotation on every frame of the clip:
// the sampling pattern never crawls.
float podiumDither( const in vec2 p ) {
  return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}

float podiumSampleDepth( sampler2D shadowMap, vec2 uv ) {
  return texture2D( shadowMap, uv ).r;
}

bool podiumIsBlocker( float sampled, float receiver ) {
  #ifdef USE_REVERSED_DEPTH_BUFFER
    return sampled > receiver;
  #else
    return sampled < receiver;
  #endif
}

float podiumPCSS( sampler2D shadowMap, vec2 shadowMapSize, vec2 uv, float zReceiver ) {
  vec2 texel = vec2( 1.0 ) / shadowMapSize;
  float phi = podiumDither( gl_FragCoord.xy ) * 6.28318530718;

  // 1. Blocker search: how far in front of this fragment is whatever is
  //    casting onto it?
  float searchRadius = PODIUM_LIGHT_SIZE * 0.5;
  float blockerSum = 0.0;
  float blockers = 0.0;
  for ( int i = 0; i < PODIUM_BLOCKER_SAMPLES; i ++ ) {
    vec2 o = podiumVogel( i, PODIUM_BLOCKER_SAMPLES, phi ) * searchRadius;
    float d = podiumSampleDepth( shadowMap, uv + o );
    if ( podiumIsBlocker( d, zReceiver ) ) {
      blockerSum += d;
      blockers += 1.0;
    }
  }
  if ( blockers < 0.5 ) return 1.0;

  float avgBlocker = blockerSum / blockers;

  // 2. Penumbra width from the parallel-plane estimate. Taking the absolute
  //    difference keeps this correct whichever way the depth buffer runs.
  float penumbra = abs( zReceiver - avgBlocker ) / max( abs( avgBlocker ), 1e-5 );
  float radius = clamp( penumbra * PODIUM_LIGHT_SIZE, PODIUM_MIN_RADIUS, PODIUM_LIGHT_SIZE );

  // 3. Filter at that width.
  float sum = 0.0;
  for ( int i = 0; i < PODIUM_FILTER_SAMPLES; i ++ ) {
    vec2 o = podiumVogel( i, PODIUM_FILTER_SAMPLES, phi ) * radius;
    float d = podiumSampleDepth( shadowMap, uv + o );
    sum += podiumIsBlocker( d, zReceiver ) ? 0.0 : 1.0;
  }
  return sum / float( PODIUM_FILTER_SAMPLES );
}
`;

// The body of the BASIC-type `getShadow` in three 0.182, which this replaces.
const ANCHOR =
  /float depth = texture2D\( shadowMap, shadowCoord\.xy \)\.r;[\s\S]*?#endif/;

let originalChunk: string | null = null;

export const installSoftShadows = (o: Required<SoftShadowsProps>) => {
  if (originalChunk === null) {
    originalChunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  }
  const base = originalChunk;
  if (!ANCHOR.test(base)) {
    throw new Error(
      "PCSS patch: could not find the BASIC getShadow body in " +
        "THREE.ShaderChunk.shadowmap_pars_fragment. three's shadow shader has " +
        "changed — update src/podium/SoftShadows.tsx rather than rendering " +
        "the set with hard shadows.",
    );
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = base
    .replace(
      "#ifdef USE_SHADOWMAP",
      `#ifdef USE_SHADOWMAP\n${glsl(o)}`,
    )
    .replace(
      ANCHOR,
      "shadow = podiumPCSS( shadowMap, shadowMapSize, shadowCoord.xy, shadowCoord.z );",
    );
};

export const uninstallSoftShadows = () => {
  if (originalChunk !== null) {
    THREE.ShaderChunk.shadowmap_pars_fragment = originalChunk;
  }
};

/**
 * Installs the PCSS chunk and recompiles. Must sit inside the canvas and
 * above anything that builds a material.
 */
export const SoftShadows: React.FC<SoftShadowsProps> = ({
  size = 0.012,
  blockerSamples = 12,
  filterSamples = 20,
  minRadius = 0.0012,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useLayoutEffect(() => {
    installSoftShadows({ size, blockerSamples, filterSamples, minRadius });
    // BasicShadowMap makes three declare the shadow map as a plain
    // `sampler2D`, which is what the blocker search needs to read depth
    // rather than only compare against it.
    gl.shadowMap.type = THREE.BasicShadowMap;
    gl.shadowMap.enabled = true;
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        gl.properties.remove(m);
        m.needsUpdate = true;
      }
    });
    gl.info.programs!.length = 0;
    gl.compile(scene, camera);
    return () => {
      uninstallSoftShadows();
    };
  }, [gl, scene, camera, size, blockerSamples, filterSamples, minRadius]);

  return null;
};
