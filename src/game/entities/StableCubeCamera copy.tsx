import { useCubeCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, useRef } from "react";
import * as THREE from "three";

type StableCubeCameraProps = {
  children: (texture: THREE.CubeTexture) => ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];

  resolution?: number;
  near?: number;
  far?: number;

  /**
   * Higher numbers run later in the frame.
   * Use a value > animated object updates so the probe captures final transforms.
   */
  renderPriority?: number;

  /**
   * Update every N frames. 1 = every frame.
   */
  frameInterval?: number;

  firstFrame?: number;

  /**
   * Optional callback for custom per-frame control before update.
   */
  beforeUpdate?: (args: {
    camera: THREE.CubeCamera;
    group: THREE.Group;
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
  }) => void;

  hideChildrenDuringCapture?: boolean;
};

export function StableCubeCamera({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  resolution = 256,
  near = 0.1,
  far = 1000,
  renderPriority,
  firstFrame = 3,
  frameInterval = 1,
  beforeUpdate,
  hideChildrenDuringCapture = true,
}: StableCubeCameraProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const frameCountRef = useRef(0);

  const { fbo, camera, update } = useCubeCamera({
    resolution,
    near,
    far,
  });

  const { texture } = fbo;

  useFrame(state => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    frameCountRef.current += 1;
    if (frameCountRef.current !== firstFrame && (frameInterval === 0 || frameCountRef.current % frameInterval !== 0)) {
      return;
    }

    const { gl } = state;

    const prevAutoClear = gl.autoClear;
    const prevVisible = group.visible;

    if (hideChildrenDuringCapture) {
      group.visible = false;
    }

    beforeUpdate?.({
      camera,
      group,
      gl,
      scene: state.scene,
    });

    gl.autoClear = true;
    update();
    gl.autoClear = prevAutoClear;

    if (hideChildrenDuringCapture) {
      group.visible = prevVisible;
    }
  }, renderPriority);

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={camera} />
      {children(texture)}
    </group>
  );
}
