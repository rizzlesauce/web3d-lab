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
          let materialPath = `${modelPath}:${obj.name}:${mat.name}`;
          let materialMapName = '';

          if (mat instanceof THREE.Material) {
            const { userData } = mat;

            if (debug) {
              console.log(materialPath, {
                side: mat.side === THREE.DoubleSide ? "DoubleSide" : mat.side === THREE.FrontSide ? "FrontSide" : "BackSide",
                transparent: mat.transparent,
                alphaHash: mat.alphaHash,
                alphaTest: mat.alphaTest,
                depthTest: mat.depthTest,
                depthWrite: mat.depthWrite,
                alphaToCoverage: mat.alphaToCoverage,
                userData,
              });
            }

            if (false && mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) {
                materialMapName = mat.map.name;
                materialPath = `${materialPath}:${materialMapName}`;
                if (debug) {
                  console.log("Found material with map:", materialPath);
                }
              }

              let alphaTest: number | undefined;

              if ((userData.three_alphaBlend || alphaBlendMaps.has(materialMapName)) && (!mat.transparent || mat.depthWrite)) {
                if (true || debug) {
                  console.log("Making material ALPHA BLEND:", materialPath);
                }
                mat.transparent = true;
                mat.depthWrite = false;
                mat.needsUpdate = true;
              } else if (userData.three_alphaHash && !mat.alphaHash) {
                if (true || debug) {
                  console.log("Making material ALPHA HASH (Dithered):", materialPath);
                }

                mat.alphaHash = true;
                mat.transparent = false;
                mat.depthWrite = true;
                mat.needsUpdate = true;
              } else if (mat.transparent) {
                if (true || debug) {
                  console.log("Making transparent material CLIPPED:", materialPath);
                }

                if (mat.alphaTest > 0) {
                  alphaTest = mat.alphaTest;
                } else {
                  alphaTest = 0.5;
                }
                mat.alphaToCoverage = true;
                mat.transparent = false;
                mat.depthWrite = true;
                mat.needsUpdate = true;
              }

              if (typeof userData.three_alphaTest === "number" && userData.three_alphaTest > 0 && userData.three_alphaTest !== mat.alphaTest) {
                if (true || debug) {
                  console.log("Making transparent material use custom ALPHA TEST:", materialPath, userData.three_alphaTest);
                }
                alphaTest = userData.three_alphaTest;
              }

              if (alphaTest !== undefined && alphaTest !== mat.alphaTest) {
                mat.alphaTest = alphaTest;
                mat.needsUpdate = true;
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
