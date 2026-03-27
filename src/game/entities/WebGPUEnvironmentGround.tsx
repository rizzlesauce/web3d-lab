import type { EnvironmentProps as DreiEnvironmentProps } from "@react-three/drei";
import { Environment as DreiEnvironment, useEnvironment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as React from "react";
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";
import * as THREE from "three/webgpu";

type GroundOptions =
  | boolean
  | {
      radius?: number;
      height?: number;
      scale?: number;
      resolution?: number;
    };

export type WebGPUEnvironmentProps = Omit<DreiEnvironmentProps, "ground"> & {
  ground?: GroundOptions;
};

function isEulerLike(
  value: THREE.Euler | [number, number, number] | undefined
): value is THREE.Euler {
  return !!value && value instanceof THREE.Euler;
}

function toEuler(
  value: THREE.Euler | [number, number, number] | undefined,
  fallback: [number, number, number] = [0, 0, 0]
): THREE.Euler {
  if (isEulerLike(value)) return value.clone();
  const [x, y, z] = value ?? fallback;
  return new THREE.Euler(x, y, z);
}

function resolveScene(
  scene: THREE.Scene | React.RefObject<THREE.Scene> | undefined,
  defaultScene: THREE.Scene
): THREE.Scene {
  if (!scene) return defaultScene;
  if ("current" in scene && scene.current) return scene.current;
  return scene as THREE.Scene;
}

function setSceneEnvProps(
  background: boolean | "only",
  scene: THREE.Scene,
  texture: THREE.Texture,
  props: {
    backgroundBlurriness?: number;
    backgroundIntensity?: number;
    backgroundRotation?: THREE.Euler | [number, number, number];
    environmentIntensity?: number;
    environmentRotation?: THREE.Euler | [number, number, number];
  }
) {
  const previous = {
    background: scene.background,
    environment: scene.environment,
    backgroundBlurriness: (scene as any).backgroundBlurriness,
    backgroundIntensity: (scene as any).backgroundIntensity,
    backgroundRotation: (scene as any).backgroundRotation?.clone?.(),
    environmentIntensity: (scene as any).environmentIntensity,
    environmentRotation: (scene as any).environmentRotation?.clone?.(),
  };

  if (background !== "only") {
    scene.environment = texture;
  }

  if (background) {
    // For grounded mode, the visible background is the GroundedSkybox mesh.
    // We intentionally do NOT set scene.background = texture here.
    scene.background = null;
  }

  if (props.backgroundBlurriness !== undefined) {
    (scene as any).backgroundBlurriness = props.backgroundBlurriness;
  }
  if (props.backgroundIntensity !== undefined) {
    (scene as any).backgroundIntensity = props.backgroundIntensity;
  }
  if (props.backgroundRotation !== undefined) {
    (scene as any).backgroundRotation = toEuler(props.backgroundRotation);
  }
  if (props.environmentIntensity !== undefined) {
    (scene as any).environmentIntensity = props.environmentIntensity;
  }
  if (props.environmentRotation !== undefined) {
    (scene as any).environmentRotation = toEuler(props.environmentRotation);
  }

  return () => {
    scene.background = previous.background;
    scene.environment = previous.environment;
    (scene as any).backgroundBlurriness = previous.backgroundBlurriness;
    (scene as any).backgroundIntensity = previous.backgroundIntensity;
    (scene as any).backgroundRotation = previous.backgroundRotation;
    (scene as any).environmentIntensity = previous.environmentIntensity;
    (scene as any).environmentRotation = previous.environmentRotation;
  };
}

function WebGPUGroundEnvironment(props: WebGPUEnvironmentProps) {
  const {
    scene: sceneProp,
    ground = true,
    background = false,
    map,
    files,
    path,
    preset,
    extensions,
    backgroundBlurriness,
    backgroundIntensity,
    backgroundRotation,
    environmentIntensity,
    environmentRotation,
    near, // ignored here, preserved only for prop compatibility
    far, // ignored here
    resolution, // ignored for load path; ground.resolution is used for mesh tessellation
    frames, // ignored here
    children, // ignored here; portal/cube-camera path is not WebGPU-safe in Drei yet
    ...rest
  } = props;

  const defaultScene = useThree((state) => state.scene);
  const scene = resolveScene(sceneProp as any, defaultScene);

  const loadedTexture = useEnvironment(
    map
      ? undefined
      : {
          files,
          path,
          preset,
          extensions,
        }
  );

  const texture = map ?? loadedTexture;

  const groundOptions =
    typeof ground === "object"
      ? ground
      : {
          height: 15,
          radius: 60,
          scale: 1000,
          resolution: 128,
        };

  const height = (groundOptions.height ?? 15) * 3.9;
  const radius = (groundOptions.radius ?? 60) * 1.0;
  const scale = (groundOptions.scale ?? 1000) * 1;
  const meshResolution = groundOptions.resolution ?? 128;

  const bgRotation = React.useMemo(
    () => toEuler(backgroundRotation as ([number, number, number] | undefined), [0, 0, 0]),
    [backgroundRotation]
  );

  const groundedSkybox = React.useMemo(() => {
    if (!texture) return null;

    const mesh = new GroundedSkybox(texture, height, radius, meshResolution);
    //mesh.scale.setScalar(scale);

    // Three.js docs note that setting y = height is often helpful so the ground sits at the origin.
    mesh.position.y = height - 13.5;
    mesh.rotation.copy(bgRotation);

    const material = mesh.material as THREE.Material & {
      toneMapped?: boolean;
      fog?: boolean;
    };

    material.depthWrite = false;
    material.toneMapped = false;
    material.fog = false;

    mesh.frustumCulled = false;

    return mesh;
  }, [texture, height, radius, meshResolution, scale, bgRotation]);

  React.useLayoutEffect(() => {
    if (!texture) return;

    return setSceneEnvProps(background, scene, texture, {
      backgroundBlurriness,
      backgroundIntensity,
      backgroundRotation: backgroundRotation as ([number, number, number] | undefined),
      environmentIntensity,
      environmentRotation: environmentRotation as ([number, number, number] | undefined),
    });
  }, [
    scene,
    texture,
    background,
    backgroundBlurriness,
    backgroundIntensity,
    backgroundRotation,
    environmentIntensity,
    environmentRotation,
  ]);

  React.useEffect(() => {
    return () => {
      if (!map && loadedTexture) {
        loadedTexture.dispose();
      }
    };
  }, [map, loadedTexture]);

  React.useEffect(() => {
    return () => {
      if (!groundedSkybox) return;
      groundedSkybox.geometry.dispose();
      (groundedSkybox.material as THREE.Material).dispose();
    };
  }, [groundedSkybox]);

  if (!groundedSkybox || !background) return null;

  return <primitive object={groundedSkybox} {...rest} />;
}

/**
 * Drop-in replacement for Drei's <Environment /> that fixes the `ground` path
 * for WebGPURenderer by using Three's GroundedSkybox.
 *
 * Notes:
 * - Non-ground usage is delegated to DreiEnvironment.
 * - `ground + children` is not supported here because Drei's portal/cube-camera
 *   implementation still uses WebGLCubeRenderTarget.
 */
export function WebGPUEnvironment(props: WebGPUEnvironmentProps) {
  const { ground, children } = props;

  if (!ground) {
    return <DreiEnvironment {...(props as DreiEnvironmentProps)} />;
  }

  if (children) {
    console.warn(
      "[WebGPUEnvironment] `ground` + `children` is not supported in this replacement yet. " +
        "Drei's live portal env path still depends on WebGLCubeRenderTarget. " +
        "Use a static env map/files/preset/map with `ground`, or remove `ground` for the portal path."
    );
  }

  return <WebGPUGroundEnvironment {...props} />;
}
