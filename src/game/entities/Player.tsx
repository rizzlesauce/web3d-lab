import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../state/useGameStore";

export function Player() {
  const ref = useRef<THREE.Mesh>(null!);
  const setRef = useGameStore((s) => s.setRef);

  useEffect(() => {
    setRef("player", ref.current);
    return () => setRef("player", undefined);
  }, [setRef]);

  const geom = useMemo(() => new THREE.BoxGeometry(1, 2, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 'lime',
    roughness: 0.65,
    metalness: 0.01,
  }), []);

  return (
    <mesh
      ref={ref}
      geometry={geom}
      material={mat}
      position={[1, 1, -1]}
      castShadow
      receiveShadow
    >
      {/* later: add child mesh for weapon/hands, etc. */}
    </mesh>
  );
}
