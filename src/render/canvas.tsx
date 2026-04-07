import { FlyControls, OrbitControls, Stats, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree, type Dpr } from "@react-three/fiber";
import type { DefaultGLProps } from "@react-three/fiber/dist/declarations/src/core/renderer";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js";
import * as THREE from "three/webgpu";
import { useGameStore } from "../game/state/useGameStore";
import { backgroundRotation, rotatingSceneForBackgroundRotation } from "../game/utility/constants";
import { rotateY } from "../game/utility/transforms";
import { asType } from "../game/utility/types";
import { useGpuTier } from "../game/utility/useGpuTier";
import type { Renderer } from "./render";

function GameCanvasGlobal() {
  const gl = useThree((s) => s.gl)
  const setRenderer = useGameStore(s => s.setRenderer);
  const shadowsType = useGameStore(s => s.shadowsType);
  const setFirstFrameRendered = useGameStore(state => state.setFirstFrameRendered);
  const setInitialFramesRendered = useGameStore(state => state.setInitialFramesRendered);

  const frameRef = useRef(0);
  const rendererRef = useRef<Renderer | null>(null);

  useLayoutEffect(() => {
    const renderer = gl as unknown as Renderer;

    console.debug("GL changed:", gl);
    frameRef.current = 0;
    rendererRef.current = renderer;
    setFirstFrameRendered(false);
    setInitialFramesRendered(false);
    setRenderer(renderer);
    return () => {
      console.debug("GL effect cleanup");
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
      setRenderer(undefined);
    }
  }, [
    gl,
    setRenderer,
    setFirstFrameRendered,
    setInitialFramesRendered,
  ]);

  useFrame(() => {
    const renderer = rendererRef.current;

    if (frameRef.current === 0) {
      console.log("First frame rendered");
      setFirstFrameRendered(true);
    } else if (frameRef.current === 3) {
      // wait enough frames for everything to load and settle
      console.log("Initial frames rendered");
      setInitialFramesRendered(true);
    }

    if (renderer) {
      if (shadowsType !== undefined) {
        if (!renderer.shadowMap.enabled || renderer.shadowMap.type !== shadowsType) {
          console.debug("Enabling shadows with type:", shadowsType);
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = shadowsType;
        }
      } else if (renderer.shadowMap.enabled) {
        console.debug("Disabling shadows");
        renderer.shadowMap.enabled = false;
      }
    }

    frameRef.current += 1;
  })

  return null;
}

type GameCanvasProps = {
  forceWebGL?: boolean;
  children: React.ReactNode;
}

export function GameCanvas({
  forceWebGL = false,
  children,
}: GameCanvasProps) {
  const renderer = useGameStore(state => state.renderer);
  //const shadowsType = useGameStore(state => state.shadowsType);
  const hdrPath = useGameStore(state => state.hdrPath);
  const sprint = useGameStore(state => state.input.sprint);
  const initialFramesRendered = useGameStore(state => state.initialFramesRendered);
  const paused = useGameStore(state => state.paused);
  const togglePaused = useGameStore(state => state.togglePaused);
  const gpuTier = useGpuTier();
  const loadingProgress = useProgress();

  const [canvasVersion, setCanvasVersion] = useState(-1);
  const [dragControlsEnabled, setDragControlsEnabled] = useState(true);
  const [statsEnabled, setStatsEnabled] = useState(true);

  const rootDivRef = useRef<HTMLDivElement>(null!);

  const dpr: Dpr = useMemo(() => {
    if (asType<boolean>(false) && gpuTier.tier >= 3) {
      return window.devicePixelRatio;
    }

    if (asType<boolean>(true) && gpuTier.tier >= 2) {
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

  const powerPreference = "high-performance" as const;
  const { samples } = gpuTier;
  const alpha = asType<boolean>(true);

  const { forceGL: gpuTierForceGL } = gpuTier;

  const shouldForceWebGL = forceWebGL || gpuTierForceGL;

  const createRenderer = useCallback(async (props: DefaultGLProps) => {
    let forcingWebGL = shouldForceWebGL;

    while (true) {
      try {
        console.debug("Creating WebGPU renderer with props:", props, 'overrides:', { samples, alpha, forcingWebGL, powerPreference });

        const renderer = new THREE.WebGPURenderer({
          ...props as WebGPURendererParameters,
          antialias: samples > 1,
          samples,
          powerPreference: "high-performance",
          alpha,
          forceWebGL: forcingWebGL,
        })
        await renderer.init();
        return renderer;
      } catch (err: unknown) {
        if (forcingWebGL) {
          throw err;
        }

        console.error(`Falling back to WebGL renderer due to error: ${(err as Error).message}`);
        forcingWebGL = true;
      }
    }
  }, [
    shouldForceWebGL,
    samples,
    alpha,
    powerPreference,
  ])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanvasVersion(v => v + 1);
  }, [createRenderer])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      // Request fullscreen on the specific element
      try {
        await rootDivRef.current.requestFullscreen();
      } catch (err: unknown) {
        console.error(`Error attempting to enable fullscreen: ${(err as Error).message}`);
      }
    } else {
      // Exit fullscreen if already in it
      try {
        await document.exitFullscreen();
      } catch (err: unknown) {
        console.error(`Error attempting to exit fullscreen: ${(err as Error).message}`);
      }
    }
  };

  return (
    <div
      ref={rootDivRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}>
      {asType<boolean>(true) && (
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
          {!initialFramesRendered && (
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
              Loading... {Math.min(loadingProgress.progress, 99).toFixed(0)}% [Tier {gpuTier.tier}] {renderer ? `(${renderer.backend.constructor.name.replaceAll('Backend', '')})` : ""}
            </div>
          )}
        </div>
      )}
      {asType<boolean>(true) && (
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
        key={canvasVersion <= 0 ? 'canvas-0' : `canvas-${canvasVersion}`}
        /*
        shadows={{
          type: THREE.BasicShadowMap,
        }}
        */
        dpr={dpr}
        style={{
          ...(!hdrPath && { background: 'gray' }),
          visibility: !initialFramesRendered
            ? "hidden"
            : "visible",
        }}
        gl={createRenderer}
        camera={{
          fov: 65,
          near: 0.09,
          far: 100,
          position: cameraPos,
        }}
        flat
      >
        <GameCanvasGlobal />

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
            //domElement={rootDivRef.current}
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
          parent={rootDivRef}
        />
      )}
    </div>
  );
}
