import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RGBELoader } from "three-stdlib";

type Shader = {
  uniforms: { [uniform: string]: THREE.IUniform };
  vertexShader: string;
  fragmentShader: string;
};

type HdriGroundPlaneProps = {
  hdrPath: string;
  noisePath?: string;

  size?: number;
  y?: number;
  radius?: number;
  fadeWidth?: number;
  projectionHeight?: number;
  projectionScale?: number;
  projectionCurve?: number;
  rotation?: number;
  groundGain?: number;
  groundContrast?: number;
  shadowOpacity?: number;
  usingInvisibleDepthPlane?: boolean;

  displacementScale?: number;
  displacementTiling?: number;
  planeSegments?: number;
};

type SharedGroundProps = {
  hdrPath: string;
  size: number;
  y: number;
  actualRadius: number;
  fadeWidth: number;
  projectionHeight: number;
  projectionScale: number;
  projectionCurve: number;
  rotation: number;
  groundGain: number;
  groundContrast: number;
  shadowOpacity: number;
  usingInvisibleDepthPlane: boolean;
};

type DisplacementProps = {
  noisePath: string;
  displacementScale: number;
  displacementTiling: number;
  planeSegments: number;
};

type GroundProjectionUniforms = {
  uEnvMap: { value: THREE.Texture };
  uRadius: { value: number };
  uFadeWidth: { value: number };
  uProjectionHeight: { value: number };
  uProjectionScale: { value: number };
  uProjectionCurve: { value: number };
  uRotation: { value: number };
  uCenter: { value: THREE.Vector2 };
  uGroundGain: { value: number };
  uGroundContrast: { value: number };
};

type GroundDisplacementUniforms = {
  uDispMap: { value: THREE.Texture };
  uDispScale: { value: number };
  uDispTiling: { value: number };
};

type PlaneMaterialRefs = {
  visibleMaterialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  shadowMaterialRef: React.RefObject<THREE.ShadowMaterial | null>;
  depthMaterialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
};

export function HdriGroundPlane(props: HdriGroundPlaneProps) {
  const {
    hdrPath,
    noisePath,
    size = 260,
    y = 0,
    radius,
    fadeWidth = 36,
    projectionHeight = 32,
    projectionScale = 0.24,
    projectionCurve = 1.8,
    rotation = 0,
    groundGain = 1.0,
    groundContrast = 1.0,
    shadowOpacity = 0.35,
    usingInvisibleDepthPlane = false,
    displacementScale = 0.35,
    displacementTiling = 0.06,
    planeSegments = 128,
  } = props;

  const shared: SharedGroundProps = {
    hdrPath,
    size,
    y,
    actualRadius: radius ?? size * 0.5,
    fadeWidth,
    projectionHeight,
    projectionScale,
    projectionCurve,
    rotation,
    groundGain,
    groundContrast,
    shadowOpacity,
    usingInvisibleDepthPlane,
  };

  if (noisePath) {
    return (
      <HdriGroundPlaneDisplaced
        shared={shared}
        displacement={{
          noisePath,
          displacementScale,
          displacementTiling,
          planeSegments,
        }}
      />
    );
  }

  return <HdriGroundPlaneFlat shared={shared} />;
}

function HdriGroundPlaneFlat({ shared }: { shared: SharedGroundProps }) {
  const refs = useGroundMaterialRefs();
  const hdrTexture = useLoader(RGBELoader, shared.hdrPath);

  const projectionUniforms = useGroundProjectionUniforms({
    hdrTexture,
    actualRadius: shared.actualRadius,
    fadeWidth: shared.fadeWidth,
    projectionHeight: shared.projectionHeight,
    projectionScale: shared.projectionScale,
    projectionCurve: shared.projectionCurve,
    rotation: shared.rotation,
    groundGain: shared.groundGain,
    groundContrast: shared.groundContrast,
  });

  useVisibleGroundProjectionPatch({
    materialRef: refs.visibleMaterialRef,
    projectionUniforms,
  });

  return (
    <GroundPlanes
      refs={refs}
      y={shared.y}
      shadowOpacity={shared.shadowOpacity}
      usingInvisibleDepthPlane={shared.usingInvisibleDepthPlane}
      planeGeometryArgs={[shared.size, shared.size]}
    />
  );
}

function HdriGroundPlaneDisplaced({
  shared,
  displacement,
}: {
  shared: SharedGroundProps;
  displacement: DisplacementProps;
}) {
  const refs = useGroundMaterialRefs();
  const hdrTexture = useLoader(RGBELoader, shared.hdrPath);
  const noiseTexture = useLoader(THREE.TextureLoader, displacement.noisePath);

  const projectionUniforms = useGroundProjectionUniforms({
    hdrTexture,
    actualRadius: shared.actualRadius,
    fadeWidth: shared.fadeWidth,
    projectionHeight: shared.projectionHeight,
    projectionScale: shared.projectionScale,
    projectionCurve: shared.projectionCurve,
    rotation: shared.rotation,
    groundGain: shared.groundGain,
    groundContrast: shared.groundContrast,
  });

  const displacementUniforms = useGroundDisplacementUniforms({
    noiseTexture,
    displacementScale: displacement.displacementScale,
    displacementTiling: displacement.displacementTiling,
  });

  useVisibleGroundProjectionPatch({
    materialRef: refs.visibleMaterialRef,
    projectionUniforms,
    displacementUniforms,
  });

  useDisplacementOnlyPatch({
    materialRef: refs.shadowMaterialRef,
    projectionUniforms,
    displacementUniforms,
  });

  useDisplacementOnlyPatch({
    materialRef: refs.depthMaterialRef,
    projectionUniforms,
    displacementUniforms,
  });

  return (
    <GroundPlanes
      refs={refs}
      y={shared.y}
      shadowOpacity={shared.shadowOpacity}
      usingInvisibleDepthPlane={shared.usingInvisibleDepthPlane}
      planeGeometryArgs={[
        shared.size,
        shared.size,
        displacement.planeSegments,
        displacement.planeSegments,
      ]}
    />
  );
}

function useGroundMaterialRefs(): PlaneMaterialRefs {
  const visibleMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const shadowMaterialRef = useRef<THREE.ShadowMaterial>(null);
  const depthMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  return {
    visibleMaterialRef,
    shadowMaterialRef,
    depthMaterialRef,
  };
}

function useGroundProjectionUniforms({
  hdrTexture,
  actualRadius,
  fadeWidth,
  projectionHeight,
  projectionScale,
  projectionCurve,
  rotation,
  groundGain,
  groundContrast,
}: {
  hdrTexture: THREE.Texture;
  actualRadius: number;
  fadeWidth: number;
  projectionHeight: number;
  projectionScale: number;
  projectionCurve: number;
  rotation: number;
  groundGain: number;
  groundContrast: number;
}): GroundProjectionUniforms {
  return useMemo(() => {
    hdrTexture.colorSpace = THREE.LinearSRGBColorSpace;
    hdrTexture.wrapS = THREE.RepeatWrapping;
    hdrTexture.wrapT = THREE.ClampToEdgeWrapping;
    hdrTexture.generateMipmaps = false;
    hdrTexture.minFilter = THREE.LinearFilter;
    hdrTexture.magFilter = THREE.LinearFilter;
    hdrTexture.needsUpdate = true;

    return {
      uEnvMap: { value: hdrTexture },
      uRadius: { value: actualRadius },
      uFadeWidth: { value: fadeWidth },
      uProjectionHeight: { value: projectionHeight },
      uProjectionScale: { value: projectionScale },
      uProjectionCurve: { value: projectionCurve },
      uRotation: { value: -rotation },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uGroundGain: { value: groundGain },
      uGroundContrast: { value: groundContrast },
    };
  }, [
    hdrTexture,
    actualRadius,
    fadeWidth,
    projectionHeight,
    projectionScale,
    projectionCurve,
    rotation,
    groundGain,
    groundContrast,
  ]);
}

function useGroundDisplacementUniforms({
  noiseTexture,
  displacementScale,
  displacementTiling,
}: {
  noiseTexture: THREE.Texture;
  displacementScale: number;
  displacementTiling: number;
}): GroundDisplacementUniforms {
  return useMemo(() => {
    noiseTexture.colorSpace = THREE.NoColorSpace;
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
    noiseTexture.magFilter = THREE.LinearFilter;
    noiseTexture.needsUpdate = true;

    return {
      uDispMap: { value: noiseTexture },
      uDispScale: { value: displacementScale },
      uDispTiling: { value: displacementTiling },
    };
  }, [noiseTexture, displacementScale, displacementTiling]);
}

function useVisibleGroundProjectionPatch({
  materialRef,
  projectionUniforms,
  displacementUniforms,
}: {
  materialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  projectionUniforms: GroundProjectionUniforms;
  displacementUniforms?: GroundDisplacementUniforms;
}) {
  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      patchGroundShader({
        shader,
        projectionUniforms,
        displacementUniforms,
        includeProjection: true,
      });
    };

    material.needsUpdate = true;
  }, [materialRef, projectionUniforms, displacementUniforms]);
}

function useDisplacementOnlyPatch({
  materialRef,
  projectionUniforms,
  displacementUniforms,
}: {
  materialRef: React.RefObject<THREE.Material | null>;
  projectionUniforms: GroundProjectionUniforms;
  displacementUniforms: GroundDisplacementUniforms;
}) {
  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      patchGroundShader({
        shader,
        projectionUniforms,
        displacementUniforms,
        includeProjection: false,
      });
    };

    material.needsUpdate = true;
  }, [materialRef, projectionUniforms, displacementUniforms]);
}

function patchGroundShader({
  shader,
  projectionUniforms,
  displacementUniforms,
  includeProjection,
}: {
  shader: Shader;
  projectionUniforms: GroundProjectionUniforms;
  displacementUniforms?: GroundDisplacementUniforms;
  includeProjection: boolean;
}) {
  Object.assign(shader.uniforms, projectionUniforms);

  if (displacementUniforms) {
    Object.assign(shader.uniforms, displacementUniforms);
    injectDisplacementVertexCode(shader);
  } else {
    injectWorldPositionOnlyVertexCode(shader);
  }

  if (includeProjection) {
    injectProjectionFragmentCode(shader);
  }
}

function injectWorldPositionOnlyVertexCode(shader: Shader) {
  shader.vertexShader =
    `
    varying vec3 vWorldPosition;
    ` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    `
    #include <worldpos_vertex>
    vWorldPosition = worldPosition.xyz;
    `
  );
}

function injectDisplacementVertexCode(shader: Shader) {
  shader.vertexShader =
    `
    uniform sampler2D uDispMap;
    uniform float uDispScale;
    uniform float uDispTiling;

    varying vec3 vWorldPosition;
    ` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `
    #include <begin_vertex>

    vec2 groundUv = position.xz * uDispTiling;
    float disp = texture2D(uDispMap, groundUv).r;
    disp = (disp - 0.5) * 2.0;

    transformed.z += disp * uDispScale;
    `
  );

  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    `
    #include <worldpos_vertex>
    vWorldPosition = worldPosition.xyz;
    `
  );
}

function injectProjectionFragmentCode(shader: Shader) {
  shader.fragmentShader =
    `
    uniform sampler2D uEnvMap;
    uniform float uRadius;
    uniform float uFadeWidth;
    uniform float uProjectionHeight;
    uniform float uProjectionScale;
    uniform float uProjectionCurve;
    uniform float uRotation;
    uniform vec2 uCenter;
    uniform float uGroundGain;
    uniform float uGroundContrast;

    varying vec3 vWorldPosition;

    const float PI = 3.1415926535897932384626433832795;

    vec2 dirToEquirectUv(vec3 dir) {
      dir = normalize(dir);
      float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
      float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
      return vec2(u, v);
    }
    ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `
    vec2 p = (vWorldPosition.xz - uCenter) * uProjectionScale;
    float dist = length(p);

    float c = cos(uRotation);
    float s = sin(uRotation);
    p = mat2(c, -s, s, c) * p;

    float r = clamp(dist / uRadius, 0.0, 1.0);
    float rWarp = pow(r, uProjectionCurve);

    vec2 warped = vec2(0.0);
    if (dist > 1e-5) {
      warped = normalize(p) * rWarp * uRadius * uProjectionScale;
    }

    vec3 dir = normalize(vec3(warped.x, -uProjectionHeight, warped.y));
    vec2 envUv = dirToEquirectUv(dir);

    vec3 projectedColor = texture2D(uEnvMap, envUv).rgb;

    projectedColor *= uGroundGain;
    projectedColor = (projectedColor - 0.5) * uGroundContrast + 0.5;
    projectedColor = clamp(projectedColor, 0.0, 1.0);

    diffuseColor.rgb = projectedColor;

    float edgeAlpha = 1.0 - smoothstep(
      uRadius - uFadeWidth,
      uRadius,
      dist
    );

    diffuseColor.a *= edgeAlpha;
    `
  );
}

function GroundPlanes({
  refs,
  y,
  shadowOpacity,
  usingInvisibleDepthPlane,
  planeGeometryArgs,
}: {
  refs: PlaneMaterialRefs;
  y: number;
  shadowOpacity: number;
  usingInvisibleDepthPlane: boolean;
  planeGeometryArgs:
    | [number, number]
    | [number, number, number, number];
}) {
  return (
    <>
      {usingInvisibleDepthPlane && (
        <mesh
          rotation-x={-Math.PI / 2}
          position={[0, y - 0.001, 0]}
          renderOrder={-1}
        >
          <planeGeometry args={planeGeometryArgs} />
          <meshBasicMaterial
            ref={refs.depthMaterialRef}
            colorWrite={false}
            depthWrite
            depthTest
            transparent={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, y, 0]}
        renderOrder={0}
      >
        <planeGeometry args={planeGeometryArgs} />
        <meshBasicMaterial
          ref={refs.visibleMaterialRef}
          color="white"
          side={THREE.DoubleSide}
          transparent
          depthWrite={!usingInvisibleDepthPlane}
          toneMapped
        />
      </mesh>

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, y + 0.001, 0]}
        receiveShadow
        renderOrder={1}
      >
        <planeGeometry args={planeGeometryArgs} />
        <shadowMaterial
          ref={refs.shadowMaterialRef}
          transparent
          opacity={shadowOpacity}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
