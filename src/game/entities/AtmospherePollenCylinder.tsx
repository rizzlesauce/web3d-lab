import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type AtmospherePollenProps = {
  count?: number;
  texturePath?: string;
  color?: THREE.ColorRepresentation;
  size?: number;
  opacity?: number;

  radius?: number;
  minY?: number;
  maxY?: number;
  groundY?: number;
  fadeY?: number;

  baseWind?: [number, number, number];

  // Direction the sunlight travels toward the scene.
  // For a directionalLight at [8, 12, 6] aimed toward origin:
  // use approximately [-8, -12, -6].
  sunlightDirection?: THREE.Vector3;
  sunGlowStrength?: number;

  spawnFadeInTime?: number;
};

const timer = new THREE.Timer();

export function AtmospherePollenCylinder({
  count = 260,
  texturePath = "/particle_sprite_soft_warm.png",
  color = "#fff4c8",
  size = 18,
  opacity = 0.6,

  radius = 12,
  minY = 0.5,
  maxY = 8,
  groundY = 0.05,
  fadeY = 0.2,

  baseWind = [0.035, -0.06, 0.01],

  sunlightDirection = new THREE.Vector3(-8, -12, -6),
  sunGlowStrength = 1.2,

  spawnFadeInTime = 1.0,
}: AtmospherePollenProps) {
  const { camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null!);

  const sprite = useLoader(THREE.TextureLoader, texturePath);

  useEffect(() => {
    sprite.colorSpace = THREE.SRGBColorSpace;
    sprite.wrapS = THREE.ClampToEdgeWrapping;
    sprite.wrapT = THREE.ClampToEdgeWrapping;
    sprite.needsUpdate = true;
  }, [sprite]);

  const sunlightDir = useMemo(
    () => sunlightDirection.clone().normalize(),
    [sunlightDirection]
  );

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const brightness = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const spawnAges = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const swayAmp = new Float32Array(count);
    const swayFreq = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(brightness, 1)
    );

    return {
      geometry,
      positions,
      alphas,
      brightness,
      velocities,
      ages,
      spawnAges,
      lifetimes,
      seeds,
      swayAmp,
      swayFreq,
    };
  }, [count]);

  useEffect(() => {
    return () => {
      data.geometry.dispose();
    };
  }, [data.geometry]);

  const tempNdc = useMemo(() => new THREE.Vector3(), []);
  const tempToCamera = useMemo(() => new THREE.Vector3(), []);
  const tempCenter = useMemo(() => new THREE.Vector3(), []);

  function randomPointInCylinder(centerX: number, centerZ: number) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = centerX + Math.cos(angle) * r;
    const z = centerZ + Math.sin(angle) * r;
    const y = THREE.MathUtils.randFloat(minY, maxY);
    return { x, y, z };
  }

  function spawnParticle(i: number, midLife = true) {
    const centerX = camera.position.x;
    const centerZ = camera.position.z;

    const p = randomPointInCylinder(centerX, centerZ);
    const i3 = i * 3;

    data.positions[i3 + 0] = p.x;
    data.positions[i3 + 1] = p.y;
    data.positions[i3 + 2] = p.z;

    data.velocities[i3 + 0] =
      baseWind[0] + THREE.MathUtils.randFloat(-0.02, 0.02);
    data.velocities[i3 + 1] =
      baseWind[1] + THREE.MathUtils.randFloat(-0.03, 0.01);
    data.velocities[i3 + 2] =
      baseWind[2] + THREE.MathUtils.randFloat(-0.02, 0.02);

    data.lifetimes[i] = THREE.MathUtils.randFloat(6, 12);

    if (midLife) {
      data.ages[i] = THREE.MathUtils.randFloat(0, data.lifetimes[i] * 0.7);
    } else {
      data.ages[i] = 0;
    }

    data.spawnAges[i] = 0;
    data.seeds[i] = Math.random() * 1000;
    data.swayAmp[i] = THREE.MathUtils.randFloat(0.02, 0.07);
    data.swayFreq[i] = THREE.MathUtils.randFloat(0.35, 0.9);

    data.alphas[i] = 0;
    data.brightness[i] = 1;
  }

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      spawnParticle(i, true);
    }

    (data.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (data.geometry.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
    (data.geometry.getAttribute("aBrightness") as THREE.BufferAttribute).needsUpdate = true;
  }, [count]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 1 / 10);

    timer.update(delta);
    const t = timer.getElapsed();

    const positions = data.positions;
    const velocities = data.velocities;
    const alphas = data.alphas;
    const brightness = data.brightness;

    tempCenter.set(camera.position.x, 0, camera.position.z);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      data.ages[i] += dt;
      data.spawnAges[i] += dt;

      // world-space drift
      positions[i3 + 0] += velocities[i3 + 0] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;

      // subtle flutter in world space
      positions[i3 + 0] +=
        Math.sin(t * data.swayFreq[i] + data.seeds[i]) *
        data.swayAmp[i] *
        dt;

      positions[i3 + 2] +=
        Math.cos(t * (data.swayFreq[i] * 0.8) + data.seeds[i] * 1.37) *
        data.swayAmp[i] *
        dt;

      positions[i3 + 1] +=
        Math.sin(t * (data.swayFreq[i] * 0.55) + data.seeds[i] * 0.73) *
        data.swayAmp[i] *
        0.15 *
        dt;

      const lifeT = data.ages[i] / data.lifetimes[i];

      const fadeIn = THREE.MathUtils.clamp(
        data.spawnAges[i] / spawnFadeInTime,
        0,
        1
      );

      let fadeOut = 1;
      if (lifeT > 0.72) {
        fadeOut = 1 - (lifeT - 0.72) / 0.28;
      }
      fadeOut = THREE.MathUtils.clamp(fadeOut, 0, 1);
      let alpha = fadeIn * fadeOut;
      const groundYFadeStart = groundY + fadeY;
      if (positions[i3 + 1] < groundYFadeStart) {
        // interpolate alpha based on height above ground
        const a = THREE.MathUtils.clamp((positions[i3 + 1] - groundY) / (groundYFadeStart - groundY), 0, 1);
        alpha = Math.min(alpha, a);
      }

      alphas[i] = alpha;

      // brighter when backlit by the sun relative to the camera
      tempToCamera
        .set(
          camera.position.x - positions[i3 + 0],
          camera.position.y - positions[i3 + 1],
          camera.position.z - positions[i3 + 2]
        )
        .normalize();

      const align = Math.max(0, tempToCamera.dot(sunlightDir));
      const glow = Math.pow(align, 3.0);
      brightness[i] = 1.0 + glow * sunGlowStrength;

      // recycle rules:
      // - expired
      // - below ground
      // - too far from camera-centered cylinder
      // - very far offscreen / behind camera
      const dx = positions[i3 + 0] - tempCenter.x;
      const dz = positions[i3 + 2] - tempCenter.z;
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      tempNdc
        .set(positions[i3 + 0], positions[i3 + 1], positions[i3 + 2])
        .project(camera);

      const expired = data.ages[i] >= data.lifetimes[i];
      const belowGround = positions[i3 + 1] < groundY;
      const outsideCylinder =
        distXZ > radius * 1.25 ||
        positions[i3 + 1] < minY - 1.0 ||
        positions[i3 + 1] > maxY + 1.0;

      const wayOffscreen =
        tempNdc.z < -1.5 ||
        tempNdc.z > 1.5 ||
        tempNdc.x < -2.0 ||
        tempNdc.x > 2.0 ||
        tempNdc.y < -2.0 ||
        tempNdc.y > 2.0;

      if (expired || belowGround || outsideCylinder || wayOffscreen) {
        spawnParticle(i, true);
      }
    }

    (data.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (data.geometry.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
    (data.geometry.getAttribute("aBrightness") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      geometry={data.geometry}
      frustumCulled={false}
      renderOrder={10}
    >
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
  attribute float aBrightness;

  varying float vAlpha;
  varying float vBrightness;

  uniform float uSize;

  void main() {
    vAlpha = aAlpha;
    vBrightness = aBrightness;

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
  varying float vBrightness;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);

    float alpha = tex.a * vAlpha * uOpacity;
    if (alpha < 0.01) discard;

    vec3 color = tex.rgb * uColor * vBrightness;

    gl_FragColor = vec4(color, alpha);
  }
`;
