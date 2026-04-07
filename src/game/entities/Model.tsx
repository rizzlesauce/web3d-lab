import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { asType } from "../utility/types";

export type ModelTransformProps = {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
};

type ModelProps = ModelTransformProps & {
  modelPath: string,
  debug?: boolean
  debugBoundingBoxes?: boolean
  alphaBlendMaps?: Set<string>
  updatingSkinnedMeshBoundingSphere?: boolean
  skinnedMeshFrustumCulledOverride?: boolean
  alphaToCoverageClip?: boolean
  alphaToCoverageDither?: boolean
};

type RenderMethod = 'opaque' | 'clip' | 'blend' | 'dither';
const RenderMethodValues: RenderMethod[] = ['opaque', 'clip', 'blend', 'dither'];
const RenderMethodValueSet = new Set<RenderMethod>(RenderMethodValues);

const worldSphere = new THREE.Sphere();

function updateWorldBoundingSphereHelper(skinnedMesh: THREE.SkinnedMesh, helperMesh: THREE.Mesh) {
  // Copy local-space bounding sphere and convert it to world space
  worldSphere.copy(skinnedMesh.boundingSphere).applyMatrix4(skinnedMesh.matrixWorld)

  // Update your debug sphere mesh in world space
  helperMesh.position.copy(worldSphere.center)
  helperMesh.scale.setScalar(worldSphere.radius)
}

function attachBoundingSphereHelper(mesh: THREE.SkinnedMesh) {
  // TODO: get this working to show the actual bounding sphere

  if (!mesh.boundingSphere) {
    mesh.computeBoundingSphere();
  }

  const sphere = mesh.boundingSphere
  if (!sphere) return

  const geo = new THREE.SphereGeometry(1, 16, 16)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
    depthTest: false,
    depthWrite: false,
  })

  const helper = new THREE.Mesh(geo, mat)
  helper.name = `${mesh.name}_boundsphere`

  updateWorldBoundingSphereHelper(mesh, helper);

  return helper
}

export function Model({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  alphaBlendMaps = new Set<string>(),
  debug = false,
  debugBoundingBoxes = false,
  updatingSkinnedMeshBoundingSphere = false,
  skinnedMeshFrustumCulledOverride = false,
  alphaToCoverageClip = true,
  alphaToCoverageDither = false,
} : ModelProps) {
  const { scene, animations } = useGLTF(modelPath);

  const { actions } = useAnimations(animations, scene);

  const [meshesNeedingPerFrameBoundaryUpdate, setMeshesNeedingPerFrameBoundaryUpdate] = useState<THREE.SkinnedMesh[]>([]);
  const boxHelpersRef = useRef<THREE.BoxHelper[]>([]);
  const sphereHelpersRef = useRef<THREE.Mesh[]>([]);

  const alphaBlendMapsKey = Array.from(alphaBlendMaps).sort().join(',');
  const alphaBlendMapsStable = useMemo(
    () => new Set<string>(alphaBlendMapsKey === '' ? [] : alphaBlendMapsKey.split(',').filter(s => s)),
    [
      alphaBlendMapsKey,
    ],
  );

  useEffect(() => {
    const boxHelpers: THREE.BoxHelper[] = [];
    const sphereHelpers: THREE.Mesh[] = [];

    if (debug) {
      meshesNeedingPerFrameBoundaryUpdate.forEach(mesh => {
        if (debugBoundingBoxes) {
          const boxHelper = new THREE.BoxHelper(mesh, 0xffff00);
          scene.add(boxHelper);
          boxHelpers.push(boxHelper);
        }

        const sphereHelper = attachBoundingSphereHelper(mesh);
        if (sphereHelper) {
          scene.add(sphereHelper);
          sphereHelpers.push(sphereHelper);
        }
      });

      boxHelpersRef.current = boxHelpers;
      sphereHelpersRef.current = sphereHelpers;
    }

    return () => {
      boxHelpers.forEach(helper => {
        helper.parent?.remove(helper);
      });
      boxHelpersRef.current = [];

      sphereHelpers.forEach(helper => {
        helper.parent?.remove(helper);
      });
      sphereHelpersRef.current = [];
    };
  }, [
    scene,
    meshesNeedingPerFrameBoundaryUpdate,
    debug,
    debugBoundingBoxes,
  ]);

  useFrame(() => {
    const boxHelpers = boxHelpersRef.current;
    const sphereHelpers = sphereHelpersRef.current;

    meshesNeedingPerFrameBoundaryUpdate.forEach((mesh, meshIndex) => {
      if (asType<boolean>(true)) {
        if (debugBoundingBoxes) {
          // not needed for frustum culling
          mesh.computeBoundingBox();
        }
        mesh.computeBoundingSphere();
      }

      if (debug) {
        const sphereHelper = sphereHelpers[meshIndex];

        if (sphereHelper) {
          updateWorldBoundingSphereHelper(mesh, sphereHelper);
        }
      }
    });

    if (debug && debugBoundingBoxes) {
      boxHelpers.forEach(helper => {
        helper.update();
      });
    }
  });

  useEffect(() => {
    if (debug) {
      console.log("Model:", modelPath)
    }

    const newMeshesNeedingPerFrameBoundaryUpdate: THREE.SkinnedMesh[] = [];

    scene.traverse(obj => {
      const objPath = `${modelPath}:${obj.name}`;

      if (debug) {
        console.log("Traversing object:", objPath, obj);
      }

      let {
        frustumCulled,
      } = obj;

      const { userData: objUserData } = obj;

      if (typeof objUserData.frustumCulled === 'boolean') {
        if (asType<boolean>(true) || debug) {
          console.log("userData.frustumCulled:", objUserData.frustumCulled, objPath);
        }
        frustumCulled = objUserData.frustumCulled;
      }

      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          const skinnedMesh = mesh as THREE.SkinnedMesh;
          if (updatingSkinnedMeshBoundingSphere) {
            newMeshesNeedingPerFrameBoundaryUpdate.push(skinnedMesh);
          }
          if (skinnedMeshFrustumCulledOverride !== undefined) {
            frustumCulled = skinnedMeshFrustumCulledOverride;
          }
        }

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

        mats.forEach(mat => {
          if (!(mat instanceof THREE.Material)) {
            return;
          }

          const materialPath = `${objPath}:${mat.name}`;
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

          const userDataFrustumCulled = userData.frustumCulled;
          if (typeof userDataFrustumCulled === 'boolean') {
            if (asType<boolean>(true) || debug) {
              console.log("Material sets userData.frustumCulled", userDataFrustumCulled, materialPath);
            }
            frustumCulled = userDataFrustumCulled;
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

          if (alphaBlendMapsStable.has(materialMapName)) {
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
              alphaToCoverage = false;
              break;

            case 'clip':
              alphaHash = false;
              transparent = false;
              depthTest = true;
              depthWrite = true;
              alphaTest = alphaTest || 0.5;
              alphaToCoverage = alphaToCoverageClip;
              break;

            case 'blend':
              alphaHash = false;
              transparent = true;
              depthTest = true;
              depthWrite = false;
              alphaTest = 0;
              alphaToCoverage = false;
              break;

            case 'dither':
              alphaHash = true;
              transparent = false;
              depthTest = true;
              depthWrite = true;
              alphaTest = 0;
              alphaToCoverage = alphaToCoverageDither;
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

      if (frustumCulled !== obj.frustumCulled) {
        if (asType<boolean>(true) || debug) {
          console.log(`Making object use frustumCulled=${frustumCulled}`, objPath);
        }
        obj.frustumCulled = frustumCulled;
      }
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeshesNeedingPerFrameBoundaryUpdate(newMeshesNeedingPerFrameBoundaryUpdate);

    Object.values(actions)[0]?.play();
  }, [
    scene,
    updatingSkinnedMeshBoundingSphere,
    skinnedMeshFrustumCulledOverride,
    debug,
    actions,
    modelPath,
    alphaBlendMapsStable,
    alphaToCoverageClip,
    alphaToCoverageDither,
  ]);

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
