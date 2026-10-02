import { MeshReflectorMaterial } from '@react-three/drei';

// Large glossy near-black navy plane. MeshReflectorMaterial with mirror=1 and
// a white diffuse makes the (blurred) reflection the only lit term, scaled by
// mixStrength; the navy comes from the emissive (×3.2 so that, after the
// ACES toe, the displayed board lands near #060B16).

export const Board = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
    <planeGeometry args={[90, 90]} />
    <MeshReflectorMaterial
      resolution={1024}
      blur={[800, 300]}
      mixBlur={0.85}
      mixStrength={0.2}
      mixContrast={1}
      mirror={1}
      depthScale={0}
      color="#ffffff"
      emissive="#060B16"
      emissiveIntensity={3.2}
      roughness={1}
      metalness={0}
    />
  </mesh>
);
