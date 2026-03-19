import { ContactShadows, Environment, GizmoHelper, GizmoViewport, Grid, useProgress } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as THREE from "three";
import { AtmospherePollenCylinder } from "../entities/AtmospherePollenCylinder";
import { Gloria } from "../entities/Gloria";
import { Ground } from "../entities/Ground";
import { HdriGroundPlane } from "../entities/HdriGroundPlane";
import { Model } from "../entities/Model";
import { OldTree } from "../entities/OldTree";
import { Player } from "../entities/Player";
import { SpinningObject } from "../entities/SpinningObject";
import { StablePmremCubeCamera } from "../entities/StablePmremCubeCamera";
import { Truck } from "../entities/Truck";
import { WarriorGirl } from "../entities/WarriorGirl";
import { Woman } from "../entities/Woman";
import { useGameStore } from "../state/useGameStore";
import { rotateY } from "../utility/transforms";
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
export const backgroundRotation = true ? 2 * Math.PI * -0.22 : 0;
export const rotatingSceneForBackgroundRotation = true && backgroundRotation !== 0;
// There is a bug with Environment backgroundRotation when ground projection is enabled
const usingEnvironmentGroundProjection = !backgroundRotation || rotatingSceneForBackgroundRotation;
const allowingHigherTier1Quality = true;

export function SandboxScene() {
  const [cubeCameraResolution, setCubeCameraResolution] = useState(64);

  const { progress: loadingProgress } = useProgress();
  const gpuTier = useGpuTier();
  const hdrPath = useGameStore(state => state.hdrPath);
  const setHdrPath = useGameStore(state => state.setHdrPath);
  const setInitialFramesRendered = useGameStore(state => state.setInitialFramesRendered);
  const frameRef = useRef(0);
  const gpuTierRef = useRef(gpuTier);
  const [searchParams, _setSearchParams] = useSearchParams();

  const usingSimplerTree = ['true', 't', '1'].includes(searchParams.get("altTree")?.toLowerCase() || "");

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

  const cubeCameraLayer = 30;
  const cubeCameraLayer2 = 31;
  const cubeCameraMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const cubeCameraMaterialRef2 = useRef<THREE.MeshPhysicalMaterial>(null);

  const camera = useThree((s) => s.camera)

  useEffect(() => {
    camera.layers.enable(cubeCameraLayer)
    camera.layers.enable(cubeCameraLayer2)
  }, [camera])

  useEffect(() => {
    if (gpuTier.tier < 0) {
      return;
    }

    const hdr = hdrs[0];
    const { resolutions } = hdr;
    let resolution = resolutions[0];
    if (gpuTier.tier >= 3 && resolutions.includes('8k')) {
      resolution = '8k';
    } else if (false && gpuTier.tier >= 2 && resolutions.includes('4k')) {
      resolution = '4k';
    } else if (allowingHigherTier1Quality && gpuTier.tier >= 1 && resolutions.includes('2k')) {
      resolution = '2k';
    } else if (resolutions.includes('1k')) {
      resolution = '1k';
    }
    setHdrPath(`/hdr/${hdr.name}_${resolution}.hdr`);
  }, [setHdrPath, gpuTier]);

  useEffect(() => {
    if (loadingProgress === 100) {
      let resolution: number;
      if (gpuTier.tier >= 3) {
        resolution = 1024;
      } else if (false && gpuTier.tier >= 2) {
        resolution = 256;
      } else if (true && allowingHigherTier1Quality && gpuTier.tier >= 1) {
        resolution = 256;
      } else if (gpuTier.tier >= 1) {
        resolution = 128;
      } else if (true) {
        resolution = 128;
      } else {
        resolution = 64;
      }
      setCubeCameraResolution(resolution);
    }
  }, [loadingProgress, gpuTier]);

  const shadowMapSize = useMemo(() => {
    if (gpuTier.tier >= 3) {
      return 2048;
    } else if ((false && gpuTier.tier >= 2) || (allowingHigherTier1Quality && gpuTier.tier >= 1)) {
      return 1024;
    } else if (gpuTier.tier >= 1) {
      return 512;
    }
    return 512;
  }, [gpuTier]);

  useFrame((state, _delta) => {
    if (frameRef.current === 0) {
      const gpuTier = gpuTierRef.current;

      if (gpuTier.tier >= 2 || (true && allowingHigherTier1Quality && gpuTier.tier >= 0)) {
        state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
      } else if (true && gpuTier.tier >= 1) {
        state.gl.shadowMap.type = THREE.PCFShadowMap;
      } else if (true) {
        state.gl.shadowMap.type = THREE.BasicShadowMap;
      }
    }

    if (frameRef.current === 2) {
      setInitialFramesRendered(true);
    }

    if (false) {
      if (rotatingSceneForBackgroundRotation) {
        console.log(rotateY(state.camera.position, backgroundRotation));
      } else {
        console.log(state.camera.position);
      }
    }

    frameRef.current += 1;
  });

  return (
    <>
      {/* Lighting */}

      {true && !!hdrPath && (
        <Environment
          files={hdrPath}
          //preset="forest"
          background
          backgroundIntensity={backgroundIntensity}
          /* known issue: backgroundRotation does not work when the ground projection is enabled */
          backgroundRotation={rotatingSceneForBackgroundRotation ? undefined : [0, backgroundRotation, 0]}
          environmentIntensity={0.5}
          environmentRotation={rotatingSceneForBackgroundRotation ? undefined : [0, backgroundRotation, 0]}
          ground={usingEnvironmentGroundProjection ? {
            height: 4,
            radius: 30,
            scale: 70,
          } : undefined}
        />
      )}

      <group
        rotation={rotatingSceneForBackgroundRotation ? [0, -backgroundRotation, 0] : undefined}
      >
        {true && (
          <ambientLight
            intensity={(false && hdrPath) ? 0.05 : 1.0}
          />
        )}

        {true && (
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

        {true && gpuTier.tier >= 0 && (
          <directionalLight
            position={[-8, 5, -5]}
            intensity={0.15}
          />
        )}

        {true && gpuTier.tier >= 0 && (
          <directionalLight
            position={[-6, 6, 8]}
            intensity={0.1}
            color="#f0f6ff"
          />
        )}

        {(false || !hdrPath) && <Ground />}

        {false && (
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

        {true && !!hdrPath && (
          <HdriGroundPlane
            hdrPath={hdrPath}
            noisePath="/textures/ground_noise.png"
            displacementScale={0.21}
            displacementTiling={0.05}
            planeSegments={256}
            size={200}
            radius={usingEnvironmentGroundProjection ? 48 : 85}
            fadeWidth={(true || (false && gpuTier.tier >= 2) || (true && allowingHigherTier1Quality && gpuTier.tier >= 0)) ? (usingEnvironmentGroundProjection ? 10 : 20) : 0}
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
            shadowOpacity={0.48}
          />
        )}

        {/* Helpful visual references */}
        {false && (
          <Grid
            position={[0, 0.002, 0]}
            infiniteGrid
          />
        )}

        {/* World */}

        {true && (
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

        {true && (
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

        {true && (
          <mesh
            position={[-3, 1, -2]}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[
              0.8,
              gpuTier.tier >= 3 ? 32 : 16,
              gpuTier.tier >= 3 ? 32 : 12,
            ]} />
            <meshStandardMaterial
              color="aqua"
              roughness={0.05}
              metalness={1}
            />
          </mesh>
        )}

        {true && (
          <SpinningObject
            position={[2, 0, 5]}
            //radPerSec={[0, 0.1, 0]}
            radPerSec={[0, Math.PI * 2 / 4, 0]}
            noSpin
          >
            <Truck
              //scale={[0.8, 0.8, 0.8]}
              rotation={[0, Math.PI / 4, 0]}
            />

            {true && gpuTier.tier >= 0 && (
              <Gloria
                position={[-1.4, 0.814, -1.2]}
                rotation={[0, -Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}

            {false && (
              <Woman
                position={[0.6, 1.788, 3.8]}
                rotation={[0, -Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}

            {false && (
              <WarriorGirl
                position={[1.2, 1.8, 4.2]}
                rotation={[0, Math.PI / 2, 0]}
                //scale={[0.8, 0.8, 0.8]}
              />
            )}
          </SpinningObject>
        )}

        {true && usingSimplerTree && (
          <OldTree
            position={[7, 0.99, 5]}
            rotation={[0, 2 * Math.PI * 0.17, 0]}
            scale={[1.2, 1.2, 1.2]}
          />
        )}

        {true && !usingSimplerTree && (
          <Model
            modelPath="/models/tree_gn_export.glb"
            position={[7, 0, 5]}
            rotation={[0, Math.PI / 4, 0]}
            //scale={[0.8, 0.8, 0.8]}
          />
        )}

        {true && (
          <>
            {false && (
              <mesh
                position={[-4, 1.5, 4]}
                //castShadow
                //receiveShadow
              >
                <sphereGeometry args={[
                  0.999,
                  gpuTier.tier >= 3 ? 32 : 16,
                  gpuTier.tier >= 3 ? 32 : 12,
                ]} />
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
                true && (false || gpuTier.tier >= 3)
                  ? 1
                  : false && (false || gpuTier.tier >= 2)
                    ? 4
                    : true && gpuTier.tier >= 0
                      ? true && allowingHigherTier1Quality
                        ? 10
                        : 20
                      : 0
              }
              near={0.01}
              autoClearDuringCapture
              //disableShadowsDuringCapture
              adoptDelayFrames={0}
              excludeLayer={cubeCameraLayer}
              //renderPriority={2}
              materialRefs={[cubeCameraMaterialRef]}
              disabled={gpuTier.tier < 0}
            >
              <mesh
                castShadow
                receiveShadow
              >
                <sphereGeometry args={[
                  1,
                  gpuTier.tier >= 3 ? 32 : 16,
                  gpuTier.tier >= 3 ? 32 : 12,
                ]} />
                <meshStandardMaterial
                  color="pink"
                  ref={cubeCameraMaterialRef}
                  envMapRotation={rotatingSceneForBackgroundRotation ? [0, -backgroundRotation, 0] : undefined}
                  metalness={1}
                  roughness={0.05}
                />
              </mesh>
            </StablePmremCubeCamera>
          </>
        )}

        {false && <Player />}

        {true && (
          <StablePmremCubeCamera
            position={[1, 1.12, -1]}
            resolution={cubeCameraResolution}
            frameInterval={
              true && (false || gpuTier.tier >= 3)
                ? 10
                : false && (false || gpuTier.tier >= 2)
                  ? 4
                  : true && gpuTier.tier >= 0
                    ? true && allowingHigherTier1Quality
                      ? 10
                      : 20
                    : 0
            }
            near={0.01}
            autoClearDuringCapture
            //disableShadowsDuringCapture
            adoptDelayFrames={0}
            excludeLayer={cubeCameraLayer2}
            //renderPriority={12}
            materialRefs={[cubeCameraMaterialRef2]}
            disabled={true || gpuTier.tier < 3}
          >
            <SpinningObject
              radPerSec={[0, -0.02, 0]}
            >
              <mesh
                castShadow
                receiveShadow
              >
                <boxGeometry args={[1, 2, 1]} />
                <meshStandardMaterial
                  color="lime"
                  ref={cubeCameraMaterialRef2}
                  envMapRotation={rotatingSceneForBackgroundRotation ? [0, -backgroundRotation, 0] : undefined}
                  metalness={0.55 /* 0.01 */}
                  roughness={0.03 /* 0.65 */}
                />
              </mesh>
            </SpinningObject>
          </StablePmremCubeCamera>
        )}
      </group>

      {true && gpuTier.tier >= 0 && (
        <AtmospherePollenCylinder
          count={gpuTier.tier >= 3 ? 30 : 30}
          texturePath="/textures/particle_sprite_soft_warm.png"
          color="#fff4c8"
          size={gpuTier.tier >= 3 ? 0.8 : 0.8}
          opacity={gpuTier.tier >= 3 ? 0.32 : 0.32}
          radius={14}
          minY={0.6}
          maxY={8}
          groundY={0.05}
          fadeY={0.27}
          baseWind={gpuTier.tier >= 3 ? [0.035, -0.18, 0.01] : [0.035, -0.18, 0.01]}
          sunlightDirection={sceneRotatedSunlightDirection}
          sunGlowStrength={1.4}
          spawnFadeInTime={0.7}
        />
      )}

      {/* doesn't work well with uneven ground */}
      {false && gpuTier.tier >= 1 && (
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

      {false && (
        /* Changes scene tone mapping */
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>
      )}

      {true && gpuTier.tier >= 1 && (
        <EffectComposer
          multisampling={0}
        >
          <>
            {true && (gpuTier.tier >= 3 || (false && allowingHigherTier1Quality && gpuTier.tier >= 1)) && (
              <N8AO
                intensity={4}
                halfRes={true || gpuTier.tier < 3}
                //color="black"
                aoRadius={1.0}
                distanceFalloff={1.0}
                aoSamples={16}
                denoiseRadius={16}
              />
            )}

            {true && (gpuTier.tier >= 3 || (true && allowingHigherTier1Quality && gpuTier.tier >= 1)) && (
              <Bloom
                intensity={0.22}
                luminanceThreshold={1.05}
                luminanceSmoothing={0.03}
              />
            )}

            {true && gpuTier.tier >= 1 && (
              <BrightnessContrast
                brightness={0}
                contrast={0.09}
              />
            )}

            {false && (
              <HueSaturation
                hue={0}
                saturation={0.01}
              />
            )}

            {true && gpuTier.tier >= 1 && (
              <Vignette
                offset={0.18}
                darkness={0.28}
              />
            )}

            {true && (gpuTier.tier >= 3 || (false && allowingHigherTier1Quality && gpuTier.tier >= 1)) && (
              <DepthOfField
                focusDistance={0.02}
                focalLength={0.01}
                bokehScale={.6}
              />
            )}

            {true && (gpuTier.tier >= 3 || (false && allowingHigherTier1Quality && gpuTier.tier >= 1)) && (
              <SMAA />
            )}

            {true && gpuTier.tier >= 1 && (
              <ToneMapping />
            )}
          </>
        </EffectComposer>
      )}
    </>
  );
}
