import { useState } from "react";
import { staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The aircraft is a supplied glTF model ("Silver Skyliner"), drawn as an
// unlit white silhouette to match the references. Because nothing samples
// its maps, the shipped asset is geometry only — the original's baseColor,
// metallic-roughness and normal textures were stripped, taking it from
// 27.5 MB to 5.7 MB and saving ~535 MB of texture memory per render
// worker. Re-export from the original if the look ever goes to lit metal.
const MODEL_PATH = "models/skyliner.glb";

// The model is authored nose along -X with its span on ±Z; the rig works
// in nose +Z, right wing +X. One quarter turn about the vertical fixes it.
const MODEL_YAW_CORRECTION = Math.PI / 2;

// Normalised so the wingspan is exactly 1 unit, which makes the `scale`
// prop read directly as "wingspan in world units".
const prepareGeometry = (source: THREE.BufferGeometry) => {
  const geo = source.clone();
  geo.deleteAttribute("uv"); // no textures are sampled

  geo.computeBoundingBox();
  const centre = geo.boundingBox!.getCenter(new THREE.Vector3());
  geo.translate(-centre.x, -centre.y, -centre.z);
  geo.rotateY(MODEL_YAW_CORRECTION);

  geo.computeBoundingBox();
  const span = geo.boundingBox!.max.x - geo.boundingBox!.min.x;
  geo.scale(1 / span, 1 / span, 1 / span);
  geo.computeBoundingSphere();
  return geo;
};

// One load per page, shared by every layer and every frame. Remotion keeps
// the page alive across the whole render, so this resolves once.
//
// Exposed through Suspense rather than a manual delayRender: <ThreeCanvas>
// already wraps its children in a <Suspense> whose fallback holds a
// delayRender handle, and — importantly — it only redraws the canvas from
// an effect keyed on the frame number. Continuing the render by hand when
// the model arrives lets Remotion screenshot a canvas that was last drawn
// before the geometry existed, so the aircraft silently goes missing.
// Suspending unmounts the canvas until the model is ready, and the remount
// draws with it in place.
type Resource = {
  geometry: THREE.BufferGeometry | null;
  error: unknown;
  promise: Promise<void> | null;
};

const resource: Resource = { geometry: null, error: null, promise: null };

const loadGeometry = (url: string) =>
  new Promise<THREE.BufferGeometry>((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        let found: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if (!found && (child as THREE.Mesh).isMesh) {
            found = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
          }
        });
        if (found) {
          resolve(prepareGeometry(found));
        } else {
          reject(new Error(`No mesh found in ${url}`));
        }
      },
      undefined,
      (err) => reject(err as Error),
    );
  });

const useAirlinerGeometry = (): THREE.BufferGeometry => {
  if (resource.error) throw resource.error;
  if (resource.geometry) return resource.geometry;
  if (!resource.promise) {
    resource.promise = loadGeometry(staticFile(MODEL_PATH)).then(
      (geo) => {
        resource.geometry = geo;
      },
      (err) => {
        resource.error = err;
      },
    );
  }
  throw resource.promise;
};

export type AircraftProps = {
  matrix: THREE.Matrix4;
  /** Wingspan in world units. */
  scale: number;
  opacity?: number;
  renderOrder?: number;
};

export const Aircraft: React.FC<AircraftProps> = ({
  matrix,
  scale,
  opacity = 1,
  renderOrder = 10,
}) => {
  const geometry = useAirlinerGeometry();

  const [material] = useState(
    () =>
      // Unlit and double-sided: the references show the aircraft as a flat
      // white silhouette, and double-siding means the model never has to
      // have consistent winding.
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        side: THREE.DoubleSide,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
  );
  material.opacity = opacity;

  // Passed as plain tuples, not Vector3/Quaternion instances. react-three-
  // fiber diffs object-valued props by reference, so a memoised vector
  // mutated in place is treated as unchanged and never re-applied — the
  // aircraft would stay pinned to wherever it was on the first frame while
  // the camera flew away from it. Tuples are compared element-wise, so
  // every frame's transform lands.
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  matrix.decompose(position, quaternion, new THREE.Vector3());

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position.x, position.y, position.z]}
      quaternion={[quaternion.x, quaternion.y, quaternion.z, quaternion.w]}
      scale={scale}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  );
};
