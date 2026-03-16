import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RGBELoader } from "three-stdlib";

type HdriGroundPlaneProps = {
  hdrPath: string;
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
  roughness?: number;
  metalness?: number;
};

export function HdriGroundPlane({
  hdrPath,
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
  roughness = 1,
  metalness = 0,
}: HdriGroundPlaneProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const hdrTexture = useLoader(RGBELoader, hdrPath);

  const actualRadius = radius ?? size * 0.5;

  const uniforms = useMemo(() => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
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
      uRotation: { value: rotation },
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

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);

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

      material.userData.shader = shader;
    };

    material.needsUpdate = true;
  }, [uniforms]);

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, y, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        ref={materialRef}
        color="white"
        roughness={roughness}
        metalness={metalness}
        side={THREE.DoubleSide}
        transparent
        depthWrite
      />
    </mesh>
  );
}
