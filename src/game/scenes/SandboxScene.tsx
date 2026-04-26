import { ContactShadows, GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three/webgpu";
import { WebGPUPostFX } from "../../render/WebGPUPostFX";
import { AtmospherePollenCylinder } from "../entities/AtmospherePollenCylinder";
import { Gloria } from "../entities/Gloria";
import { Ground } from "../entities/Ground";
import { HdriGroundPlane } from "../entities/HdriGroundPlane";
import { Model } from "../entities/Model";
import { OldTree } from "../entities/OldTree";
import { Player } from "../entities/Player";
import { RecompilingMeshStandardMaterial } from "../entities/RecompilingMeshStandardMaterial";
import { SpinningObject } from "../entities/SpinningObject";
import { StablePmremCubeCamera } from "../entities/StablePmremCubeCamera";
import { Truck } from "../entities/Truck";
import { WarriorGirl } from "../entities/WarriorGirl";
import { WebGPUEnvironment as Environment } from "../entities/WebGPUEnvironmentGround";
import { Woman } from "../entities/Woman";
import { useGameStore } from "../state/useGameStore";
import { backgroundRotation, rotatingSceneForBackgroundRotation } from "../utility/constants";
import { rotateY } from "../utility/transforms";
import { asType } from "../utility/types";
import { useGpuTier } from "../utility/useGpuTier";

const hdrs = [
  {
    name: 'meadow',
    resolutions: [
      '1k',
      '2k',
      '4k',
      '8k',
      '16k',
    ],
  },
  {
    name: 'studio_country_hall',
    resolutions: [
      '1k',
    ],
  },
  {
    name: 'citrus_orchard_road_puresky',
    resolutions: [
      '1k',
      '2k',
      '4k',
    ],
  },
];

const backgroundIntensity = 0.5;
// There is a bug with Environment backgroundRotation when ground projection is enabled
const usingEnvironmentGroundProjection = asType<boolean>(true) && (!backgroundRotation || rotatingSceneForBackgroundRotation);

export function SandboxScene() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl);

  const gpuTier = useGpuTier();

  const hdrPath = useGameStore(state => state.hdrPath);
  //const scenePass = useGameStore(state => state.scenePass);
  const setHdrPath = useGameStore(state => state.setHdrPath);
  const firstFrameRendered = useGameStore(state => state.firstFrameRendered);
  const setShadowsType = useGameStore(state => state.setShadowsType);
  const shadowsType = useGameStore(state => state.shadowsType);

  const [cameraMask, setCameraMask] = useState(camera.layers.mask);
  const [cubeCameraResolution, setCubeCameraResolution] = useState(64);

  let renderPriority = gpuTier.postEnabled ? 1 : undefined;
  const postFxRenderPriority = renderPriority === undefined ? undefined : renderPriority++;
  const cubeCamera1RenderPriority = renderPriority === undefined ? undefined : renderPriority++;
  const cubeCamera2RenderPriority = renderPriority === undefined ? undefined : renderPriority++;

  const { allowingHigherTier1Quality } = gpuTier;
  const aoExcludeLayer = 10;
  const particlesMainCameraLayer = aoExcludeLayer;
  //const particlesMainCameraLayer = 11;
  //const particlesCubeCameraLayer = 12;
  const ssrIncludeLayer = 20;
  const cubeCamera1Layer = 30;
  const cubeCamera2Layer = 31;

  const usingSimplerTree = gpuTier.altTree;
  const hidingTruck = asType<boolean>(false) || !gpuTier.truckEnabled;
  const cubeCameraDisabled = asType<boolean>(false) || !gpuTier.cubeCameraEnabled;

  const sunPosition = useMemo(() => {
    return new THREE.Vector3(8, 12, 6);
  }, []);

  const sceneRotatedSunPosition = useMemo(() => {
    let rotated = sunPosition.clone();

    if (rotatingSceneForBackgroundRotation) {
      rotated = rotateY(rotated, -backgroundRotation);
    }

    return rotated;
  }, [sunPosition]);

  const sceneRotatedSunlightDirection = useMemo(
    () => sceneRotatedSunPosition.clone().negate().normalize(),
    [sceneRotatedSunPosition],
  );

  const sceneRotation: [number, number, number] | undefined = useMemo(
    () => rotatingSceneForBackgroundRotation ? [0, -backgroundRotation, 0] : undefined,
    [],
  );

  const sceneRotationInverse: [number, number, number] | undefined = useMemo(
    () => rotatingSceneForBackgroundRotation ? [0, -backgroundRotation, 0] : undefined,
    [],
  );

  /*
  const sceneDepthNode = useMemo(() => {
    return scenePass?.getTextureNode('depth');
  }, [scenePass]);
  */

  useLayoutEffect(() => {
    camera.layers.enable(cubeCamera1Layer)
    camera.layers.enable(cubeCamera2Layer)
    camera.layers.enable(aoExcludeLayer)
    camera.layers.enable(particlesMainCameraLayer)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCameraMask(camera.layers.mask)
  }, [
    camera,
    cubeCamera1Layer,
    cubeCamera2Layer,
    aoExcludeLayer,
    particlesMainCameraLayer,
  ])

  useLayoutEffect(() => {
    if (asType<boolean>(false) || gpuTier.tier < 0) {
      setHdrPath(undefined);
      return;
    }

    const hdr = hdrs[0];
    const { resolutions } = hdr;
    let resolution = resolutions[0];
    if (asType<boolean>(false) && gpuTier.tier >= 3 && resolutions.includes('8k')) {
      resolution = '8k';
    } else if (asType<boolean>(true) && gpuTier.tier >= 3 && resolutions.includes('4k')) {
      resolution = '4k';
    } else if (asType<boolean>(false) && gpuTier.tier >= 2 && resolutions.includes('4k')) {
      resolution = '4k';
    } else if (allowingHigherTier1Quality && gpuTier.tier >= 1 && resolutions.includes('2k')) {
      resolution = '2k';
    } else if (resolutions.includes('1k')) {
      resolution = '1k';
    }
    setHdrPath(`/hdr/${hdr.name}_${resolution}.hdr`);
  }, [
    setHdrPath,
    gpuTier.tier,
    allowingHigherTier1Quality,
  ]);

  useLayoutEffect(() => {
    if (firstFrameRendered) {
      let resolution = 64;

      if (asType<boolean>(true) && gpuTier.tier >= 3) {
        resolution = 1024;
      } else if (asType<boolean>(false) && gpuTier.tier >= 3) {
        resolution = 512;
      } else if (asType<boolean>(false) && gpuTier.tier >= 2) {
        resolution = 256;
      } else if (asType<boolean>(true) && allowingHigherTier1Quality && gpuTier.tier >= 1) {
        resolution = 256;
      } else if (gpuTier.tier >= 1) {
        resolution = 128;
      } else if (asType<boolean>(true)) {
        resolution = 128;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCubeCameraResolution(resolution);
    }
  }, [
    firstFrameRendered,
    gpuTier.tier,
    allowingHigherTier1Quality,
  ]);

  useLayoutEffect(() => {
    gl.setClearColor(0x000000, hdrPath ? 1 : 0);
    gl.clear()
  }, [
    gl,
    hdrPath,
  ]);

  const shadowMapSize = useMemo(() => {
    if (gpuTier.tier >= 3) {
      return 2048;
    } else if ((asType<boolean>(false) && gpuTier.tier >= 2) || (allowingHigherTier1Quality && gpuTier.tier >= 1)) {
      // to prevent flickering shadow under cube camera sphere
      return 2048;
    // eslint-disable-next-line no-dupe-else-if
    } else if ((asType<boolean>(false) && gpuTier.tier >= 2) || (allowingHigherTier1Quality && gpuTier.tier >= 1)) {
      return 1024;
    } else if (gpuTier.tier >= 1) {
      return 512;
    }
    return 512;
  }, [
    gpuTier.tier,
    allowingHigherTier1Quality,
  ]);

  useLayoutEffect(() => {
    if (firstFrameRendered) {
      let shadowsTypeNew: THREE.ShadowMapType | undefined;
      switch (gpuTier.shadowsType) {
        case 'pcf':
          shadowsTypeNew = THREE.PCFShadowMap;
          break;
        case 'basic':
          shadowsTypeNew = THREE.BasicShadowMap;
          break;
        case 'none':
          shadowsTypeNew = undefined;
          break;
        case 'soft':
          shadowsTypeNew = THREE.PCFSoftShadowMap;
          break;
        case 'vsm':
          shadowsTypeNew = THREE.VSMShadowMap;
          break;
      }
      setShadowsType(shadowsTypeNew);
      console.log(`Shadows set to: ${gpuTier.shadowsType}`);
    }
  }, [
    firstFrameRendered,
    gl,
    gpuTier.shadowsType,
    setShadowsType,
  ]);

  useFrame(({ camera }) => {
    if (asType<boolean>(false)) {
      if (rotatingSceneForBackgroundRotation) {
        console.log(rotateY(camera.position, backgroundRotation));
      } else {
        console.log(camera.position);
      }
    }
  });

  return (
    <>
      {/* Lighting */}

      {asType<boolean>(true) && !!hdrPath && (
        <Environment
          files={hdrPath}
          //preset="forest"
          background
          backgroundIntensity={backgroundIntensity}
          /* known issue: backgroundRotation does not work when the ground projection is enabled */
          backgroundRotation={rotatingSceneForBackgroundRotation ? undefined : [0, backgroundRotation, 0]}
          environmentIntensity={0.9}
          environmentRotation={rotatingSceneForBackgroundRotation ? undefined : [0, backgroundRotation, 0]}
          {...asType<boolean>(true) && usingEnvironmentGroundProjection
            ? {
              ground: {
                height: 4,
                radius: 30,
                scale: 70,
              }
            }
            : {}
          }
        />
      )}

      <group
        rotation={sceneRotation}
      >
        {asType<boolean>(true) && (
          <ambientLight
            intensity={(asType<boolean>(true) && hdrPath) ? 0.65 : 1.0}
          />
        )}

        {asType<boolean>(true) && (
          <directionalLight
            position={sunPosition}
            intensity={1.5}
            color="#fff6e8"
            castShadow
            shadow-bias={-0.0001}
            shadow-normalBias={0.02}
            shadow-mapSize-width={shadowMapSize}
            shadow-mapSize-height={shadowMapSize}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-camera-near={0.5}
            shadow-camera-far={50}
          />
        )}

        {asType<boolean>(true) && gpuTier.tier >= 0 && (
          <directionalLight
            position={[-8, 5, -5]}
            intensity={0.15}
          />
        )}

        {asType<boolean>(true) && gpuTier.tier >= 0 && (
          <directionalLight
            position={[-6, 6, 8]}
            intensity={0.1}
            color="#f0f6ff"
          />
        )}

        {asType<boolean>(true) && (asType<boolean>(false) || !hdrPath) && <Ground />}

        {asType<boolean>(false) && !hdrPath && (
          <mesh
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <planeGeometry args={[75, 75]} />
            <meshStandardMaterial
              color="gray"
              roughness={1}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {asType<boolean>(true) && !!hdrPath && (
          <HdriGroundPlane
            hdrPath={hdrPath}
            noisePath="/textures/ground_noise.png"
            displacementScale={0.21}
            displacementTiling={0.05}
            planeSegments={256}
            size={200}
            radius={usingEnvironmentGroundProjection ? 48 : 85}
            fadeWidth={(asType<boolean>(true) || (asType<boolean>(false) && gpuTier.tier >= 2) || (asType<boolean>(true) && allowingHigherTier1Quality && gpuTier.tier >= 0)) ? (usingEnvironmentGroundProjection ? 10 : 20) : 0}
            projectionHeight={32}
            projectionScale={2}
            projectionCurve={1.8}
            rotation={rotatingSceneForBackgroundRotation ? undefined : backgroundRotation}
            //groundGain={0.94}
            groundGain={0.7}
            //groundContrast={1.03}
            //tint="#7c745f"
            //tint="#6c6c6c"
            //tintStrength={0}
            //backgroundIntensity={backgroundIntensity}
            //lightingMix={0}
            shadowOpacity={shadowsType === undefined ? 0 : 0.48}
          />
        )}

        {/* Helpful visual references */}
        {asType<boolean>(false) && (
          <Grid
            position={[0, 0.002, 0]}
            infiniteGrid
          />
        )}

        {/* World */}

        {asType<boolean>(true) && (
          <SpinningObject
            position={[4.5, 1, .2]}
            radPerSec={[0, -.2, 0]}
            //noSpin
          >
            <mesh
              castShadow
              receiveShadow
            >
              <boxGeometry args={[1, 1.5, 1]} />
              <meshStandardMaterial
                color="red"
                roughness={0.3}
                metalness={0.01}
              />
            </mesh>
          </SpinningObject>
        )}

        {asType<boolean>(true) && (
          <SpinningObject
            position={[2.9, 1, -0.5]}
            radPerSec={[0, .1, 0]}
            //noSpin
          >
            <mesh
              castShadow
              receiveShadow
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color="orange"
                roughness={0.2}
                metalness={0.02}
              />
            </mesh>
          </SpinningObject>
        )}

        {asType<boolean>(true) && (
          <mesh
            position={[-3, 1, -2]}
            castShadow
            receiveShadow
          >
            <sphereGeometry
              args={[
                0.8,
                gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 24 : 16,
                gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 20 : 12,
              ]}
            />
            <meshStandardMaterial
              color="aqua"
              roughness={0.05}
              metalness={1}
            />
          </mesh>
        )}

        {asType<boolean>(true) && (
          <SpinningObject
            position={[2, 0, 5]}
            //radPerSec={[0, 0.1, 0]}
            radPerSec={[0, Math.PI * 2 / 4, 0]}
            noSpin
          >
            {asType<boolean>(true) && !hidingTruck && (
              <Truck
                //scale={[0.8, 0.8, 0.8]}
                rotation={[0, Math.PI / 4, 0]}
              />
            )}

            {asType<boolean>(true) && gpuTier.tier >= 0 && (
              <Gloria
                position={[
                  -1.4,
                  hidingTruck ? -0.07 : 0.814,
                  -1.2
                ]}
                rotation={[0, -Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}

            {asType<boolean>(false) && (
              <Woman
                position={[0.6, 1.788, 3.8]}
                rotation={[0, -Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}

            {asType<boolean>(false) && (
              <WarriorGirl
                position={[1.2, 1.8, 4.2]}
                rotation={[0, Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}
          </SpinningObject>
        )}

        {asType<boolean>(true) && usingSimplerTree && (
          <OldTree
            position={[7, 0.99, 5]}
            rotation={[0, 2 * Math.PI * 0.17, 0]}
            scale={[1.2, 1.2, 1.2]}
          />
        )}

        {asType<boolean>(true) && !usingSimplerTree && (
          <Model
            modelPath="/models/tree_gn_export.glb"
            position={[7, 0, 5]}
            rotation={[0, Math.PI / 4, 0]}
            //scale={[0.8, 0.8, 0.8]}
          />
        )}

        {asType<boolean>(true) && (
          <>
            {asType<boolean>(false) && (
              <mesh
                position={[-4, 1.5, 4]}
                //castShadow
                //receiveShadow
              >
                <sphereGeometry
                  args={[
                    0.999,
                    gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 24 : 16,
                    gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 20 : 12,
                  ]}
                />
                <meshStandardMaterial
                  color="pink"
                  metalness={1}
                  roughness={0.05}
                />
              </mesh>
            )}

            <StablePmremCubeCamera
              position={[-4, 1.5, 4]}
              resolution={cubeCameraResolution}
              frameInterval={
                asType<boolean>(true) && (asType<boolean>(false) || gpuTier.tier >= 3)
                  ? 1
                  : asType<boolean>(false) && (asType<boolean>(false) || gpuTier.tier >= 2)
                    ? 4
                    : asType<boolean>(true) && gpuTier.tier >= 0
                      ? asType<boolean>(true) && allowingHigherTier1Quality
                        ? 10
                        : 20
                      : 0
              }
              cameraMask={cameraMask}
              //includeLayers={particlesCubeCameraLayer}
              excludeLayers={cubeCamera1Layer}
              disabled={asType<boolean>(false) || cubeCameraDisabled}
              renderPriority={cubeCamera1RenderPriority}
              envRotation={sceneRotationInverse}
            >
              {({ envNode }) => (
                <>
                  <mesh
                    castShadow
                    receiveShadow
                    layers={cubeCamera1Layer}
                  >
                    <sphereGeometry
                      args={[
                        1,
                        gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 24 : 16,
                        gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 20 : 12,
                      ]}
                    />
                    <RecompilingMeshStandardMaterial
                      color="pink"
                      envNode={envNode}
                      envMapRotation={sceneRotation}
                      metalness={1}
                      roughness={0.05}
                    />
                  </mesh>

                  {gpuTier.ssrEnabled && (
                    <mesh
                      layers={ssrIncludeLayer}
                    >
                      <sphereGeometry
                        args={[
                          1,
                          gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 24 : 16,
                          gpuTier.tier >= 3 ? 32 : gpuTier.tier >= 2 ? 20 : 12,
                        ]}
                      />
                      <meshStandardMaterial
                        color="black"
                        metalness={0}
                        roughness={1}
                      />
                    </mesh>
                  )}
                </>
              )}
            </StablePmremCubeCamera>
          </>
        )}

        {asType<boolean>(false) && <Player />}

        {asType<boolean>(true) && (
          <StablePmremCubeCamera
            position={[1, 1.12, -1]}
            resolution={cubeCameraResolution}
            frameInterval={
              asType<boolean>(true) && (asType<boolean>(false) || gpuTier.tier >= 3)
                ? 10
                : asType<boolean>(false) && (asType<boolean>(false) || gpuTier.tier >= 2)
                  ? 4
                  : asType<boolean>(true) && gpuTier.tier >= 0
                    ? asType<boolean>(true) && allowingHigherTier1Quality
                      ? 10
                      : 20
                    : 0
            }
            cameraMask={cameraMask}
            //includeLayers={particlesCubeCameraLayer}
            excludeLayers={cubeCamera2Layer}
            disabled={asType<boolean>(true) || cubeCameraDisabled}
            renderPriority={cubeCamera2RenderPriority}
            envRotation={sceneRotationInverse}
          >
            {({ envNode }) => (
              <SpinningObject
                radPerSec={[0, -0.02, 0]}
              >
                <mesh
                  castShadow
                  receiveShadow
                  layers={cubeCamera2Layer}
                >
                  <boxGeometry args={[1, 2, 1]} />
                  <RecompilingMeshStandardMaterial
                    color="lime"
                    envNode={envNode}
                    envMapRotation={sceneRotation}
                    metalness={0.55 /* 0.01 */}
                    roughness={0.03 /* 0.65 */}
                  />
                </mesh>
              </SpinningObject>
            )}
          </StablePmremCubeCamera>
        )}
      </group>

      {asType<boolean>(true) && gpuTier.tier >= 0 && (
        <AtmospherePollenCylinder
          count={30}
          texturePath="/textures/particle_sprite_soft_warm.png"
          color="#fff4c8"
          size={0.8}
          opacity={0.32}
          radius={14}
          minY={0.6}
          maxY={8}
          groundY={0.05}
          fadeY={0.27}
          baseWind={[0.035, -0.18, 0.01]}
          sunlightDirection={sceneRotatedSunlightDirection}
          sunGlowStrength={1.4}
          spawnFadeInTime={0.7}
          layer={particlesMainCameraLayer}
          //sceneDepthNode={sceneDepthNode}
          //layer2={particlesCubeCameraLayer}
        />
      )}

      {/* doesn't work well with uneven ground */}
      {asType<boolean>(false) && gpuTier.tier >= 1 && (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.4}
          scale={25}
          blur={2}
          far={7}
          //width={1000}
          //height={1000}
        />
      )}

      {asType<boolean>(false) && (
        /* Changes scene tone mapping */
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>
      )}

      {asType<boolean>(true) && gpuTier.postEnabled && (
        <WebGPUPostFX
          cameraMask={cameraMask}
          gpuTier={gpuTier}
          allowingHigherTier1Quality={allowingHigherTier1Quality}
          enableAO={gpuTier.aoEnabled}
          enableSSR={gpuTier.ssrEnabled}
          enableBloom={true}
          enableContrast={true}
          enableVignette={false}
          enableDOF={true}
          aoExcludeLayer={aoExcludeLayer}
          //particlesLayer={particlesMainCameraLayer}
          enableFxaa={false}
          enableSmaa={true}
          resolutionScale={1}
          ssrExcludeLayers={cubeCamera1Layer}
          ssrIncludeLayers={gpuTier.ssrEnabled ? ssrIncludeLayer : undefined}
          renderPriority={postFxRenderPriority}
        />
      )}
    </>
  );
}
