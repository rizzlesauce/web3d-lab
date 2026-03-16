import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import { enableShadows } from "../utility/shadows";

export type ModelTransformProps = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  alphaBlendMaps?: Set<string>
  debug?: boolean
};

type ModelProps = ModelTransformProps & {
  modelPath: string,
};

export function Model({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  alphaBlendMaps = new Set<string>(),
  debug = false,
} : ModelProps) {
  const { scene, animations } = useGLTF(modelPath);

  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    enableShadows(scene);

    if (debug) {
      console.log("Model Debug Info:", modelPath)
    }

    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]

        mats.forEach(mat => {
          if (mat instanceof THREE.Material) {
            if (debug) {
              console.log(obj.name, {
                side: mat.side,
                transparent: mat.transparent,
                alphaTest: mat.alphaTest,
                depthWrite: mat.depthWrite,
                alphaToCoverage: mat.alphaToCoverage,
              });
            }

            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) {
                if (debug) {
                  console.log("Found material with map:", mat.map.name);
                }
                if (mat.transparent && !alphaBlendMaps.has(mat.map.name)) {
                  if (debug) {
                    console.log("Making transparent material CLIPPED:", mat.map.name);
                  }
                  mat.transparent = false;
                  mat.alphaTest = 0.5;
                  mat.depthWrite = true;
                  mat.alphaToCoverage = true;
                  mat.needsUpdate = true;
                }
              }
            }
          }
        })
      }
    })

    Object.values(actions)[0]?.play();
  }, [scene]);

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <primitive object={scene} />
    </group>
  );
}
