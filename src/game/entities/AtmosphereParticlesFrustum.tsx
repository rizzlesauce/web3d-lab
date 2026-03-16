import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type AtmosphereParticlesFrustumProps = {
  count?: number;
  texturePath?: string;
  color?: THREE.ColorRepresentation;
  size?: number;
  opacity?: number;

  nearDist?: number;
  farDist?: number;

  widthFactor?: number;
  heightFactor?: number;

  wind?: [number, number, number];
};

export function AtmosphereParticlesFrustum({
  count = 220,
  texturePath = "/textures/particle_sprite_soft_warm.png",
  color = "#fff6d8",
  size = 14,
  opacity = 0.75,

  nearDist = 1.5,
  farDist = 18,

  widthFactor = 1.25,
  heightFactor = 1.25,

  wind = [0.08, -0.42, 0.02],
}: AtmosphereParticlesFrustumProps) {
  const { camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null!);

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

    // camera-local particle state
    const localX = new Float32Array(count);
    const localY = new Float32Array(count);
    const localZ = new Float32Array(count);

    const ages = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const speeds = new Float32Array(count);
    const swayAmp = new Float32Array(count);
    const swayFreq = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

    return {
      geometry,
      positions,
      alphas,
      localX,
      localY,
      localZ,
      ages,
      lifetimes,
      seeds,
      speeds,
      swayAmp,
      swayFreq,
    };
  }, [count]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const fovRad = THREE.MathUtils.degToRad(cam.fov);

    function respawnParticle(i: number, biasTop = false) {
      const depth = THREE.MathUtils.lerp(
        nearDist,
        farDist,
        Math.random()
      );

      const halfHeight = Math.tan(fovRad * 0.5) * depth * heightFactor;
      const halfWidth = halfHeight * cam.aspect * widthFactor;

      data.localZ[i] = depth;
      data.localX[i] = THREE.MathUtils.randFloatSpread(halfWidth * 2);
      data.localY[i] = biasTop
        ? THREE.MathUtils.randFloat(halfHeight * 0.2, halfHeight)
        : THREE.MathUtils.randFloatSpread(halfHeight * 2);

      data.ages[i] = 0;
      data.lifetimes[i] = THREE.MathUtils.randFloat(4.5, 8.5);
      data.seeds[i] = Math.random() * 1000;
      data.speeds[i] = THREE.MathUtils.randFloat(0.8, 1.4);
      data.swayAmp[i] = THREE.MathUtils.randFloat(0.04, 0.12);
      data.swayFreq[i] = THREE.MathUtils.randFloat(0.5, 1.2);
      data.alphas[i] = 0;
    }

    for (let i = 0; i < count; i++) {
      respawnParticle(i, false);
      data.ages[i] = Math.random() * data.lifetimes[i];
    }

    const posAttr = data.geometry.getAttribute("position") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }, [
    camera,
    count,
    data,
    nearDist,
    farDist,
    widthFactor,
    heightFactor,
  ]);

  useEffect(() => {
    return () => {
      data.geometry.dispose();
    };
  }, [data.geometry]);

  useFrame((state, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();

    const fovRad = THREE.MathUtils.degToRad(cam.fov);

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    camera.getWorldDirection(forward);
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    const camPos = camera.position;

    const positions = data.positions;
    const alphas = data.alphas;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      data.ages[i] += dt;

      // camera-local drift
      data.localX[i] += wind[0] * data.speeds[i] * dt;
      data.localY[i] += wind[1] * data.speeds[i] * dt;
      data.localZ[i] += wind[2] * data.speeds[i] * dt;

      // subtle flutter
      data.localX[i] +=
        Math.sin(t * data.swayFreq[i] + data.seeds[i]) *
        data.swayAmp[i] *
        dt;

      data.localY[i] +=
        Math.cos(t * (data.swayFreq[i] * 0.7) + data.seeds[i] * 1.31) *
        data.swayAmp[i] *
        0.35 *
        dt;

      // lifetime fade
      const lifeT = data.ages[i] / data.lifetimes[i];
      let alphaLife = 1.0;

      if (lifeT < 0.18) {
        alphaLife = lifeT / 0.18;
      } else if (lifeT > 0.72) {
        alphaLife = 1 - (lifeT - 0.72) / 0.28;
      }
      alphaLife = THREE.MathUtils.clamp(alphaLife, 0, 1);

      // frustum bounds at this depth
      const depth = data.localZ[i];
      const halfHeight = Math.tan(fovRad * 0.5) * depth * heightFactor;
      const halfWidth = halfHeight * cam.aspect * widthFactor;

      const outOfBounds =
        depth < nearDist ||
        depth > farDist ||
        data.localX[i] < -halfWidth ||
        data.localX[i] > halfWidth ||
        data.localY[i] < -halfHeight ||
        data.localY[i] > halfHeight ||
        data.ages[i] >= data.lifetimes[i];

      if (outOfBounds) {
        // respawn near top/front of view so they drift downward across camera
        const newDepth = THREE.MathUtils.lerp(nearDist, farDist, Math.random());
        const newHalfHeight = Math.tan(fovRad * 0.5) * newDepth * heightFactor;
        const newHalfWidth = newHalfHeight * cam.aspect * widthFactor;

        data.localZ[i] = newDepth;
        data.localX[i] = THREE.MathUtils.randFloatSpread(newHalfWidth * 2);
        data.localY[i] = THREE.MathUtils.randFloat(newHalfHeight * 0.15, newHalfHeight);

        data.ages[i] = 0;
        data.lifetimes[i] = THREE.MathUtils.randFloat(4.5, 8.5);
        data.seeds[i] = Math.random() * 1000;
        data.speeds[i] = THREE.MathUtils.randFloat(0.8, 1.4);
        data.swayAmp[i] = THREE.MathUtils.randFloat(0.04, 0.12);
        data.swayFreq[i] = THREE.MathUtils.randFloat(0.5, 1.2);
        alphas[i] = 0;
      } else {
        alphas[i] = alphaLife;
      }

      // camera-local -> world
      const worldPos = new THREE.Vector3()
        .copy(camPos)
        .addScaledVector(forward, data.localZ[i])
        .addScaledVector(right, data.localX[i])
        .addScaledVector(up, data.localY[i]);

      positions[i3 + 0] = worldPos.x;
      positions[i3 + 1] = worldPos.y;
      positions[i3 + 2] = worldPos.z;
    }

    const posAttr = data.geometry.getAttribute("position") as THREE.BufferAttribute;
    const alphaAttr = data.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={data.geometry} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
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

    gl_PointSize = max(2.0, uSize * (180.0 / -mvPosition.z));
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
