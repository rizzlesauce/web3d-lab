import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type AtmosphereParticlesProps = {
  count?: number;
  area?: [number, number, number];
  baseY?: number;
  texturePath?: string;
  color?: THREE.ColorRepresentation;
  size?: number;
  opacity?: number;
  wind?: [number, number, number];
};

export function AtmosphereParticles({
  count = 180,
  area = [18, 8, 18],
  baseY = 0.5,
  texturePath = "/textures/particle_sprite_soft_warm.png",
  color = "#fff8e8",
  size = 0.16,
  opacity = 0.32,
  wind = [0.08, -0.35, 0.02],
}: AtmosphereParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!);
  const { camera } = useThree();

  const sprite = useLoader(THREE.TextureLoader, texturePath);

  useEffect(() => {
    sprite.colorSpace = THREE.SRGBColorSpace;
    sprite.wrapS = THREE.ClampToEdgeWrapping;
    sprite.wrapT = THREE.ClampToEdgeWrapping;
    sprite.needsUpdate = true;
  }, [sprite]);

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const seeds = new Float32Array(count);
    const ages = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const speeds = new Float32Array(count);
    const swayAmp = new Float32Array(count);
    const swayFreq = new Float32Array(count);

    const initialCenterX = camera.position.x;
    const initialCenterZ = camera.position.z;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      positions[i3 + 0] = initialCenterX + (Math.random() - 0.5) * area[0];
      positions[i3 + 1] = baseY + Math.random() * area[1];
      positions[i3 + 2] = initialCenterZ + (Math.random() - 0.5) * area[2];

      alphas[i] = 0;
      seeds[i] = Math.random() * 1000;
      ages[i] = Math.random() * 8;
      lifetimes[i] = 5 + Math.random() * 6;
      speeds[i] = 0.6 + Math.random() * 0.8;
      swayAmp[i] = 0.03 + Math.random() * 0.08;
      swayFreq[i] = 0.4 + Math.random() * 0.9;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

    return {
      geometry,
      positions,
      alphas,
      seeds,
      ages,
      lifetimes,
      speeds,
      swayAmp,
      swayFreq,
    };
  }, [count, area, baseY, camera.position.x, camera.position.z]);

  useEffect(() => {
    return () => {
      data.geometry.dispose();
    };
  }, [data.geometry]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    const centerX = camera.position.x;
    const centerZ = camera.position.z;

    const positionsAttr = data.geometry.getAttribute("position") as THREE.BufferAttribute;
    const alphaAttr = data.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;

    const positions = positionsAttr.array as Float32Array;
    const alphas = alphaAttr.array as Float32Array;

    const halfX = area[0] * 0.5;
    const halfY = area[1] * 0.5;
    const halfZ = area[2] * 0.5;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      data.ages[i] += dt;

      const lifeT = data.ages[i] / data.lifetimes[i];

      // fade in / fade out across lifetime
      let alphaLife = 1;
      if (lifeT < 0.18) {
        alphaLife = lifeT / 0.18;
      } else if (lifeT > 0.72) {
        alphaLife = 1 - (lifeT - 0.72) / 0.28;
      }
      alphaLife = THREE.MathUtils.clamp(alphaLife, 0, 1);

      // downward drift + slight wind
      positions[i3 + 0] += (wind[0] * data.speeds[i]) * dt;
      positions[i3 + 1] += (wind[1] * data.speeds[i]) * dt;
      positions[i3 + 2] += (wind[2] * data.speeds[i]) * dt;

      // subtle wandering so it doesn't look perfectly linear
      positions[i3 + 0] += Math.sin(t * data.swayFreq[i] + data.seeds[i]) * data.swayAmp[i] * dt;
      positions[i3 + 2] += Math.cos(t * (data.swayFreq[i] * 0.8) + data.seeds[i] * 1.37) * data.swayAmp[i] * dt;

      alphas[i] = alphaLife;

      const outOfY =
        positions[i3 + 1] < baseY - halfY ||
        positions[i3 + 1] > baseY + area[1];

      const outOfX =
        positions[i3 + 0] < centerX - halfX ||
        positions[i3 + 0] > centerX + halfX;

      const outOfZ =
        positions[i3 + 2] < centerZ - halfZ ||
        positions[i3 + 2] > centerZ + halfZ;

      const expired = data.ages[i] >= data.lifetimes[i];

      if (expired || outOfY || outOfX || outOfZ) {
        positions[i3 + 0] = centerX + (Math.random() - 0.5) * area[0];
        positions[i3 + 1] = baseY + area[1] * (0.75 + Math.random() * 0.25);
        positions[i3 + 2] = centerZ + (Math.random() - 0.5) * area[2];

        data.ages[i] = 0;
        data.lifetimes[i] = 5 + Math.random() * 6;
        data.speeds[i] = 0.6 + Math.random() * 0.8;
        data.swayAmp[i] = 0.03 + Math.random() * 0.08;
        data.swayFreq[i] = 0.4 + Math.random() * 0.9;
        data.seeds[i] = Math.random() * 1000;
        alphas[i] = 0;
      }
    }

    positionsAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={data.geometry} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.NormalBlending}
        uniforms={{
          uMap: { value: sprite },
          uColor: { value: new THREE.Color(color) },
          uSize: { value: size },
          uOpacity: { value: opacity },
        }}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
      />
    </points>
  );
}

const particleVertexShader = `
  attribute float aAlpha;
  varying float vAlpha;

  uniform float uSize;

  void main() {
    vAlpha = aAlpha;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // perspective-correct point size
    gl_PointSize = uSize * (120.0 / -mvPosition.z);
  }
`;

const particleFragmentShader = `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);

    float alpha = tex.a * vAlpha * uOpacity;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(tex.rgb * uColor, alpha);
  }
`;
