import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import { enableShadows } from "../utility/shadows";
import { asType } from "../utility/types";

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

type RenderMethod = 'opaque' | 'clip' | 'blend' | 'dither';
const RenderMethodValues: RenderMethod[] = ['opaque', 'clip', 'blend', 'dither'];
const RenderMethodValueSet = new Set<RenderMethod>(RenderMethodValues);

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
          if (!(mat instanceof THREE.Material)) {
            return;
          }

          let materialPath = `${modelPath}:${obj.name}:${mat.name}`;
          let materialMapName = '';

          const { userData } = mat;

          if (asType<boolean>(true) && (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) && mat.map) {
            materialMapName = mat.map.name;
          }

          let {
            alphaHash,
            transparent,
            depthTest,
            depthWrite,
            alphaTest,
            alphaToCoverage,
          } = mat;

          let renderMethodOriginal: RenderMethod | undefined;
          if (alphaHash) {
            renderMethodOriginal = 'dither';
          } else if (transparent) {
            renderMethodOriginal = 'blend';
          } else if (alphaTest) {
            renderMethodOriginal = 'clip';
          } else {
            renderMethodOriginal = 'opaque';
          }

          let renderMethod: RenderMethod | undefined;

          if (debug) {
            console.log(
              materialPath, {
                side: mat.side === THREE.DoubleSide ? 'both' : mat.side === THREE.FrontSide ? 'front' : 'back',
                renderMethod: renderMethodOriginal,
              }, {
                alphaHash: mat.alphaHash,
                transparent: mat.transparent,
                depthTest: mat.depthTest,
                depthWrite: mat.depthWrite,
                alphaTest: mat.alphaTest,
                alphaToCoverage: mat.alphaToCoverage,
              }, {
                map: materialMapName,
              },
              'userData',
              userData,
            );
          }

          const userDataOpaque = userData.three_opaque;
          if (userDataOpaque) {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.three_opaque", userDataOpaque, materialPath);
            }
            renderMethod = 'opaque';
          }

          const userDataAlphaClip = userData.three_alphaClip;
          if (userDataAlphaClip) {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.three_alphaClip", userDataAlphaClip, materialPath);
            }
            renderMethod = 'clip';
          }

          const userDataAlphaBlend = userData.three_alphaBlend;
          if (userDataAlphaBlend) {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.three_alphaBlend", userDataAlphaBlend, materialPath);
            }
            renderMethod = 'blend';
          }

          const userDataAlphaHash = userData.three_alphaHash;
          if (userDataAlphaHash) {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.three_alphaHash", userDataAlphaHash, materialPath);
            }
            renderMethod = 'dither';
          }

          const userDataRenderMethod = userData.three_renderMethod;
          if (userDataRenderMethod) {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.three_renderMethod", userDataRenderMethod, materialPath);
            }
            if (RenderMethodValueSet.has(userDataRenderMethod)) {
              renderMethod = userDataRenderMethod;
            } else {
              console.warn("Invalid value for userData.three_renderMethod", userDataRenderMethod, materialPath);
            }
          }

          if (alphaBlendMaps.has(materialMapName)) {
            if (asType<boolean>(true) || debug) {
              console.log("Material is in alphaBlendMaps", materialPath);
            }
            renderMethod = 'blend';
          }

          if (asType<boolean>(false) && renderMethodOriginal === 'blend') {
            if (renderMethod !== 'clip' && (asType<boolean>(true) || debug)) {
              console.log("Making transparent material CLIPPED:", materialPath);
            }
            renderMethod = 'clip';
          }

          switch (renderMethod) {
            case 'opaque':
              alphaHash = false;
              transparent = false;
              depthTest = true;
              depthWrite = true;
              alphaTest = 0;
              if (asType<boolean>(true)) {
                alphaToCoverage = false;
              }
              break;

            case 'clip':
              alphaHash = false;
              transparent = false;
              depthTest = true;
              depthWrite = true;
              alphaTest = alphaTest || 0.5;
              if (asType<boolean>(true)) {
                alphaToCoverage = true;
              }
              break;

            case 'blend':
              alphaHash = false;
              transparent = true;
              depthTest = true;
              depthWrite = false;
              alphaTest = 0;
              if (asType<boolean>(true)) {
                alphaToCoverage = false;
              }
              break;

            case 'dither':
              alphaHash = true;
              transparent = false;
              depthTest = true;
              depthWrite = true;
              alphaTest = 0;
              if (asType<boolean>(true)) {
                // May have little to no impact
                alphaToCoverage = true;
              }
              break;
          }

          const userDataDepthTest = userData.three_depthTest;
          if (typeof userDataDepthTest === "boolean") {
            if (asType<boolean>(true) || debug) {
              console.log("Material has userData.three_depthTest", userDataDepthTest, materialPath);
            }
            depthTest = userDataDepthTest;
          }

          const userDataDepthWrite = userData.three_depthWrite;
          if (typeof userDataDepthWrite === "boolean") {
            if (asType<boolean>(true) || debug) {
              console.log("Material has userData.three_depthWrite", userDataDepthWrite, materialPath);
            }
            depthWrite = userDataDepthWrite;
          }

          const userDataAlphaTest = userData.three_alphaTest;
          if (typeof userDataAlphaTest === "number" && userDataAlphaTest > 0 && userDataAlphaTest <= 1) {
            if (asType<boolean>(true) || debug) {
              console.log("Material has userData.three_alphaTest", userDataAlphaTest, materialPath);
            }
            alphaTest = userDataAlphaTest;
          }

          const userDataAlphaToCoverage = userData.three_alphaToCoverage;
          if (typeof userDataAlphaToCoverage === "boolean") {
            if (asType<boolean>(true) || debug) {
              console.log("Material has userData.three_alphaToCoverage", userDataAlphaToCoverage, materialPath);
            }
            alphaToCoverage = userDataAlphaToCoverage;
          }

          if (alphaHash !== mat.alphaHash) {
            if (asType<boolean>(true) || debug) {
              console.log(`Making material use alphaHash=${alphaHash}`, materialPath);
            }
            mat.alphaHash = alphaHash;
            mat.needsUpdate = true;
          }

          if (transparent !== mat.transparent) {
            if (asType<boolean>(true) || debug) {
              if (asType<boolean>(true) || debug) {
                console.log(`Making material use transparent=${transparent}`, materialPath);
              }
            }
            mat.transparent = transparent;
            mat.needsUpdate = true;
          }

          if (depthTest !== mat.depthTest) {
            if (asType<boolean>(true) || debug) {
              console.log(`Making material use depthTest=${depthTest}`, materialPath);
            }
            mat.depthTest = depthTest;
            mat.needsUpdate = true;
          }

          if (depthWrite !== mat.depthWrite) {
            if (asType<boolean>(true) || debug) {
              console.log(`Making material use depthWrite=${depthWrite}`, materialPath);
            }
            mat.depthWrite = depthWrite;
            mat.needsUpdate = true;
          }

          if (alphaTest !== mat.alphaTest) {
            if (asType<boolean>(true) || debug) {
              console.log(`Making material use alphaTest=${alphaTest}`, materialPath);
            }
            mat.alphaTest = alphaTest;
            mat.needsUpdate = true;
          }

          if (alphaToCoverage !== mat.alphaToCoverage) {
            if (asType<boolean>(true) || debug) {
              console.log(`Making material use alphaToCoverage=${alphaToCoverage}`, materialPath);
            }
            mat.alphaToCoverage = alphaToCoverage;
            mat.needsUpdate = true;
          }
        });
      }
    });

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
