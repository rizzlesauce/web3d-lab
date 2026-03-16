import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

type SpinningObjectProps = {
  children: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  radPerSec?: [number, number, number];
  renderPriority?: number;
  noSpin?: boolean;
};

export function SpinningObject({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  radPerSec = [0, 0.5, 0],
  renderPriority,
  noSpin = false,
}: SpinningObjectProps) {
  const ref = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    if (noSpin) return;
    ref.current.rotation.x += radPerSec[0] * delta;
    ref.current.rotation.y += radPerSec[1] * delta;
    ref.current.rotation.z += radPerSec[2] * delta;
  }, renderPriority);

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {children}
    </group>
  );
}
