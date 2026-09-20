import * as THREE from "three";

/**
 * The subset of `MeshPhysicalMaterial` parameters both the classic and the
 * node implementation accept identically. Keeping the factory to this subset
 * is what lets one scene description drive WebGPU and WebGL without forking.
 */
export type PhysicalParams = ConstructorParameters<
  typeof THREE.MeshPhysicalMaterial
>[0];

type NodeCtors = {
  MeshPhysicalNodeMaterial: new (params?: PhysicalParams) => THREE.Material;
};

let nodeCtors: NodeCtors | null = null;

/** Preloads `three/webgpu` so the material factory can stay synchronous. */
export const loadNodeMaterials = async () => {
  if (nodeCtors) {
    return;
  }
  const mod = await import("three/webgpu");
  nodeCtors = {
    MeshPhysicalNodeMaterial: mod.MeshPhysicalNodeMaterial as unknown as NodeCtors["MeshPhysicalNodeMaterial"],
  };
};

export const createPhysicalMaterial = (
  useNodeMaterials: boolean,
  params: PhysicalParams,
): THREE.Material => {
  if (useNodeMaterials && nodeCtors) {
    return new nodeCtors.MeshPhysicalNodeMaterial(params);
  }
  return new THREE.MeshPhysicalMaterial(params);
};
