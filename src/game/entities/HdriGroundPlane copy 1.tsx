import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
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
  shadowOpacity?: number;
};

export function HdriGroundPlane({
  hdrPath,
  size = 200,
  y = 0,
  radius,
  fadeWidth = 16,
  projectionHeight = 12,
  projectionScale = 1,
  rotation = 0,
  tint = "#7a7468",
  tintStrength = 0.06,
  shadowOpacity = 0.2,
}: HdriGroundPlaneProps) {
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
  ]);

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, y, 0]}
      >
        <planeGeometry args={[size, size, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={THREE.DoubleSide}
          transparent={false}
          depthWrite
          depthTest
          toneMapped={false}
        />
      </mesh>

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, y + 0.001, 0]}
        receiveShadow
      >
        <planeGeometry args={[size, size, 1, 1]} />
        <shadowMaterial
          transparent
          opacity={shadowOpacity}
        />
      </mesh>
    </>
  );
}

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform sampler2D uEnvMap;
  uniform float uRadius;
  uniform float uFadeWidth;
  uniform float uProjectionHeight;
  uniform float uProjectionScale;
  uniform float uRotation;
  uniform vec2 uCenter;
  uniform vec3 uTint;
  uniform float uTintStrength;

  varying vec3 vWorldPosition;

  const float PI = 3.1415926535897932384626433832795;

  vec2 dirToEquirectUv(vec3 dir) {
    dir = normalize(dir);
    float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    return vec2(u, v);
  }

  void main() {
    vec2 p = (vWorldPosition.xz - uCenter) * uProjectionScale;
    float dist = length(p);

    if (dist > uRadius) discard;

    // Rotate the projected lookup around the center if desired
    float c = cos(uRotation);
    float s = sin(uRotation);
    p = mat2(c, -s, s, c) * p;

    // Project from a virtual panorama capture point above the ground
    vec3 dir = normalize(vec3(p.x, -uProjectionHeight, p.y));
    vec2 uv = dirToEquirectUv(dir);

    vec3 envColor = texture2D(uEnvMap, uv).rgb;

    float edgeFade = smoothstep(uRadius - uFadeWidth, uRadius, dist);
    vec3 color = mix(envColor, mix(envColor, uTint, uTintStrength), edgeFade);

    gl_FragColor = vec4(color, 1.0);
  }
`;
