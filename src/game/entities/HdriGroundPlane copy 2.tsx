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
  rotation?: number;

  tint?: THREE.ColorRepresentation;
  tintStrength?: number;

  backgroundIntensity?: number;
  lightingMix?: number;

  roughness?: number;
  metalness?: number;
};

export function HdriGroundPlane({
  hdrPath,
  size = 200,
  y = 0,
  radius,
  fadeWidth = 16,
  projectionHeight = 18,
  projectionScale = 0.35,
  rotation = 0,
  tint = "#7a7468",
  tintStrength = 0.06,
  backgroundIntensity = 0.5,
  lightingMix = 0.15,
  roughness = 1,
  metalness = 0,
}: HdriGroundPlaneProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  const hdrTexture = useLoader(RGBELoader, hdrPath);
  const actualRadius = radius ?? size * 0.5;

  const uniforms = useMemo(() => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    hdrTexture.wrapS = THREE.RepeatWrapping;
    hdrTexture.wrapT = THREE.ClampToEdgeWrapping;
    hdrTexture.needsUpdate = true;

    return {
      uEnvMap: { value: hdrTexture },
      uRadius: { value: actualRadius },
      uFadeWidth: { value: fadeWidth },
      uProjectionHeight: { value: projectionHeight },
      uProjectionScale: { value: projectionScale },
      uRotation: { value: rotation },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uTint: { value: new THREE.Color(tint) },
      uTintStrength: { value: tintStrength },
      uBackgroundIntensity: { value: backgroundIntensity },
      uLightingMix: { value: lightingMix },
    };
  }, [
    hdrTexture,
    actualRadius,
    fadeWidth,
    projectionHeight,
    projectionScale,
    rotation,
    tint,
    tintStrength,
    backgroundIntensity,
    lightingMix,
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
        uniform float uRotation;
        uniform vec2 uCenter;
        uniform vec3 uTint;
        uniform float uTintStrength;
        uniform float uBackgroundIntensity;
        uniform float uLightingMix;

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

        if (dist > uRadius) discard;

        float c = cos(uRotation);
        float s = sin(uRotation);
        p = mat2(c, -s, s, c) * p;

        vec3 dir = normalize(vec3(p.x, -uProjectionHeight, p.y));
        vec2 envUv = dirToEquirectUv(dir);

        vec3 envColor = texture2D(uEnvMap, envUv).rgb;

        float edgeFade = smoothstep(uRadius - uFadeWidth, uRadius, dist);
        vec3 projectedColor = mix(
          envColor,
          mix(envColor, uTint, uTintStrength),
          edgeFade
        );

        projectedColor *= uBackgroundIntensity;

        diffuseColor.rgb *= projectedColor;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        `
        // outgoingLight is the fully lit MeshStandard result.
        // We blend it back toward the projected HDR ground color
        // so the ground matches the HDR background more closely.
        outgoingLight = mix(diffuseColor.rgb, outgoingLight, uLightingMix);

        #include <output_fragment>
        `
      );
    };

    material.needsUpdate = true;
  }, [uniforms]);

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, y, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size, 1, 1]} />
      <meshStandardMaterial
        ref={materialRef}
        color="white"
        roughness={roughness}
        metalness={metalness}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
