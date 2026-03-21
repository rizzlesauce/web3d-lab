import { FlyControls, OrbitControls, Stats, useProgress } from "@react-three/drei";
import { Canvas, type Dpr } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { backgroundRotation, rotatingSceneForBackgroundRotation } from "../game/scenes/SandboxScene";
import { useGameStore } from "../game/state/useGameStore";
import { rotateY } from "../game/utility/transforms";
import { asType } from "../game/utility/types";
import { useGpuTier } from "../game/utility/useGpuTier";

export function GameCanvas({ children }: { children: React.ReactNode }) {
  const hdrPath = useGameStore(state => state.hdrPath);
  const sprint = useGameStore(state => state.input.sprint);
  const initialFramesRendered = useGameStore(state => state.initialFramesRendered);
  const paused = useGameStore(state => state.paused);
  const togglePaused = useGameStore(state => state.togglePaused);
  const gpuTier = useGpuTier();
  const { progress: loadingProgress } = useProgress();

  const [dragControlsEnabled, setDragControlsEnabled] = useState(true);
  const [statsEnabled, setStatsEnabled] = useState(true);

  const elementRef = useRef<HTMLDivElement>(null!);

  const dpr: Dpr = useMemo(() => {
    if (false && gpuTier.tier >= 3) {
      return window.devicePixelRatio;
    }

    if (true && gpuTier.tier >= 2) {
      return [1, 2];
    }

    return Math.min(window.devicePixelRatio, gpuTier.tier >= 1 ? 1.5 : 1.25);
  }, [gpuTier]);

  const cameraPos = useMemo(() => {
    let position = new THREE.Vector3(-7.35730398642059, 3.7448684273251636, 6.917083092852292);
    if (rotatingSceneForBackgroundRotation) {
      position = rotateY(position, -backgroundRotation);
    }
    return position;
  }, [])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      // Request fullscreen on the specific element
      try {
        await elementRef.current.requestFullscreen();
      } catch (err: any) {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      }
    } else {
      // Exit fullscreen if already in it
      try {
        await document.exitFullscreen();
      } catch (err: any) {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      }
    }
  };

  return (
    <div
      ref={elementRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}>
      {true && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 40,
            zIndex: 1000,
            background: "transparent",
          }}
          onPointerDown={() => setDragControlsEnabled(false)}
          onPointerUp={() => setDragControlsEnabled(true)}
          onPointerCancel={() => setDragControlsEnabled(true)}
          onClick={() => {
            if (statsEnabled) {
              setStatsEnabled(false);
            } else {
              const wasPaused = paused;
              togglePaused();
              if (wasPaused) {
                setStatsEnabled(true);
              }
            }
          }}
        >
          {(loadingProgress < 100 || !initialFramesRendered) && (
            /* center the loading text */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
              }}
            >
              Loading... {Math.min(loadingProgress, 99).toFixed(0)}% [Tier {gpuTier.tier}]
            </div>
          )}
        </div>
      )}
      {true && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 40,
            height: 40,
            zIndex: 1001,
            background: "transparent",
          }}
          onClick={() => toggleFullscreen()}
        />
      )}
      <Canvas
        shadows
        dpr={dpr}
        style={{
          ...(!hdrPath && { background: 'gray' }),
          visibility: loadingProgress < 100 || !initialFramesRendered ? "hidden" : "visible",
        }}
        flat
        gl={{
          /* AA is done in postprocessing */
          //antialias: true,
          powerPreference: "high-performance",
          alpha: !hdrPath,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          fov: 65,
          near: 0.09,
          far: 100,
          position: cameraPos,
        }}
      >
        {/* Camera controls */}
        {asType<boolean>(true) || gpuTier.isMobile ? (
          <OrbitControls
            makeDefault
            enabled={dragControlsEnabled}
            enableDamping
            dampingFactor={0.08}
            //maxPolarAngle={Math.PI * 0.47}
            minDistance={1}
            maxDistance={15}
          />
        ) : (
          <FlyControls
            //domElement={elementRef.current}
            makeDefault
            dragToLook
            movementSpeed={sprint ? 1.0 : 0.1}
            rollSpeed={2 * Math.PI / 20}
          />
        )}

        {children}
      </Canvas>

      {statsEnabled && (
        <Stats
          parent={elementRef}
        />
      )}
    </div>
  );
}
