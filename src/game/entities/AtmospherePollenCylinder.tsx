import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { attribute, depth, float, screenUV, smoothstep, texture, uniform, uv } from "three/tsl";
import * as THREE from "three/webgpu";

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
  sunlightDirection?: THREE.Vector3;
  sunGlowStrength?: number;
  spawnFadeInTime?: number;

  layer?: number;
  sceneDepthNode?: THREE.TextureNode;
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
  layer = 11,
  sceneDepthNode,
}: AtmospherePollenProps) {
  const { camera, size: viewportSize, scene } = useThree();

  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const opacityUniformRef = useRef<THREE.UniformNode<'float', number> | null>(null);

  const sprite = useLoader(THREE.TextureLoader, texturePath);

  // Do not dispose this texture manually.
  // useLoader caches/shared resources; disposing can race with in-flight WebGPU submits.
  useEffect(() => {
    sprite.colorSpace = THREE.SRGBColorSpace;
    sprite.wrapS = THREE.ClampToEdgeWrapping;
    sprite.wrapT = THREE.ClampToEdgeWrapping;
    sprite.needsUpdate = true;
  }, [sprite]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const sunlightDir = useMemo(
    () => sunlightDirection.clone().normalize(),
    [sunlightDirection]
  );

  const quadGeometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(2, 2, 1, 1);

    const instanceAlpha = new Float32Array(count);
    const instanceColor = new Float32Array(count * 3);

    const alphaAttr = new THREE.InstancedBufferAttribute(instanceAlpha, 1);
    alphaAttr.setUsage(THREE.DynamicDrawUsage);

    const colorAttr = new THREE.InstancedBufferAttribute(instanceColor, 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);

    g.setAttribute("instanceAlpha", alphaAttr);
    g.setAttribute("instanceColor", colorAttr);

    return {
      geometry: g,
      instanceAlpha,
      instanceColor,
      alphaAttr,
      colorAttr,
    };
  }, [count]);

  useEffect(() => {
    return () => {
      quadGeometry.geometry.dispose();
    };
  }, [quadGeometry]);

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.depthTest = !sceneDepthNode;
    mat.blending = THREE.AdditiveBlending;
    mat.alphaTest = 0.01;
    mat.fog = true;

    const tex = texture(sprite, uv());
    const instanceAlpha = attribute<"float">("instanceAlpha");
    const instanceColor = attribute<"vec3">("instanceColor");
    const opacityUniform = uniform(opacity, "float");

    opacityUniformRef.current = opacityUniform;

    mat.colorNode = tex.rgb.mul(instanceColor);

    const baseOpacity = tex.a.mul(instanceAlpha).mul(opacityUniform)

    if (sceneDepthNode) {
      const opaqueDepth = sceneDepthNode.sample(screenUV).r

      // Current particle fragment depth
      const particleDepth = depth

      const depthBias = float(0.0015)
      const depthFeather = float(0.003)

      // Visible if particle is in front of the opaque scene depth
      const visibleMask = smoothstep(
        particleDepth.sub(depthBias),
        particleDepth.add(depthFeather),
        opaqueDepth
      )

      mat.opacityNode = baseOpacity.mul(visibleMask)
    } else {
      mat.opacityNode = baseOpacity
    }

    return mat
  }, [
    sprite,
    scene,
    camera,
    layer,
    sceneDepthNode,
  ]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (opacityUniformRef.current) {
      opacityUniformRef.current.value = opacity;
    }
  }, [opacity]);

  const particleState = useMemo(() => {
    const centers = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const spawnAges = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const swayAmp = new Float32Array(count);
    const swayFreq = new Float32Array(count);
    const scales = new Float32Array(count);
    const alphas = new Float32Array(count);
    const brightness = new Float32Array(count);

    return {
      centers,
      velocities,
      ages,
      spawnAges,
      lifetimes,
      seeds,
      swayAmp,
      swayFreq,
      scales,
      alphas,
      brightness,
    };
  }, [count]);

  const tempNdc = useMemo(() => new THREE.Vector3(), []);
  const tempToCamera = useMemo(() => new THREE.Vector3(), []);
  const tempCenter = useMemo(() => new THREE.Vector3(), []);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const mvPos = useMemo(() => new THREE.Vector3(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  function randomPointInCylinder(centerX: number, centerZ: number) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;

    return {
      x: centerX + Math.cos(angle) * r,
      y: THREE.MathUtils.randFloat(minY, maxY),
      z: centerZ + Math.sin(angle) * r,
    };
  }

  function spawnParticle(i: number, midLife = true) {
    const centerX = camera.position.x;
    const centerZ = camera.position.z;
    const p = randomPointInCylinder(centerX, centerZ);
    const i3 = i * 3;

    particleState.centers[i3 + 0] = p.x;
    particleState.centers[i3 + 1] = p.y;
    particleState.centers[i3 + 2] = p.z;

    particleState.velocities[i3 + 0] =
      baseWind[0] + THREE.MathUtils.randFloat(-0.02, 0.02);
    particleState.velocities[i3 + 1] =
      baseWind[1] + THREE.MathUtils.randFloat(-0.03, 0.01);
    particleState.velocities[i3 + 2] =
      baseWind[2] + THREE.MathUtils.randFloat(-0.02, 0.02);

    particleState.lifetimes[i] = THREE.MathUtils.randFloat(6, 12);
    particleState.ages[i] = midLife
      ? THREE.MathUtils.randFloat(0, particleState.lifetimes[i] * 0.7)
      : 0;

    particleState.spawnAges[i] = 0;
    particleState.seeds[i] = Math.random() * 1000;
    particleState.swayAmp[i] = THREE.MathUtils.randFloat(0.02, 0.07);
    particleState.swayFreq[i] = THREE.MathUtils.randFloat(0.35, 0.9);

    particleState.alphas[i] = 0;
    particleState.brightness[i] = 1;
    particleState.scales[i] = 0.01;
  }

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      spawnParticle(i, true);
    }

    quadGeometry.alphaAttr.needsUpdate = true;
    quadGeometry.colorAttr.needsUpdate = true;
  }, [count]); // intentional

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 1 / 10);

    timer.update(delta);
    const t = timer.getElapsed();

    tempCenter.set(camera.position.x, 0, camera.position.z);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      particleState.ages[i] += dt;
      particleState.spawnAges[i] += dt;

      particleState.centers[i3 + 0] += particleState.velocities[i3 + 0] * dt;
      particleState.centers[i3 + 1] += particleState.velocities[i3 + 1] * dt;
      particleState.centers[i3 + 2] += particleState.velocities[i3 + 2] * dt;

      particleState.centers[i3 + 0] +=
        Math.sin(t * particleState.swayFreq[i] + particleState.seeds[i]) *
        particleState.swayAmp[i] *
        dt;

      particleState.centers[i3 + 2] +=
        Math.cos(
          t * (particleState.swayFreq[i] * 0.8) +
            particleState.seeds[i] * 1.37
        ) *
        particleState.swayAmp[i] *
        dt;

      particleState.centers[i3 + 1] +=
        Math.sin(
          t * (particleState.swayFreq[i] * 0.55) +
            particleState.seeds[i] * 0.73
        ) *
        particleState.swayAmp[i] *
        0.15 *
        dt;

      const lifeT = particleState.ages[i] / particleState.lifetimes[i];

      const fadeIn = THREE.MathUtils.clamp(
        particleState.spawnAges[i] / spawnFadeInTime,
        0,
        1
      );

      let fadeOut = 1;
      if (lifeT > 0.72) {
        fadeOut = 1 - (lifeT - 0.72) / 0.28;
      }
      fadeOut = THREE.MathUtils.clamp(fadeOut, 0, 1);

      let alpha = fadeIn * fadeOut;

      const y = particleState.centers[i3 + 1];
      const groundYFadeStart = groundY + fadeY;

      if (y < groundYFadeStart) {
        const a = THREE.MathUtils.clamp(
          (y - groundY) / (groundYFadeStart - groundY),
          0,
          1
        );
        alpha = Math.min(alpha, a);
      }

      particleState.alphas[i] = alpha;

      tempToCamera
        .set(
          camera.position.x - particleState.centers[i3 + 0],
          camera.position.y - particleState.centers[i3 + 1],
          camera.position.z - particleState.centers[i3 + 2]
        )
        .normalize();

      const align = Math.max(0, tempToCamera.dot(sunlightDir));
      const glow = Math.pow(align, 3.0);
      const bright = 1.0 + glow * sunGlowStrength;
      particleState.brightness[i] = bright;

      worldPos.set(
        particleState.centers[i3 + 0],
        particleState.centers[i3 + 1],
        particleState.centers[i3 + 2]
      );

      tempNdc.copy(worldPos).project(camera);

      const dx = particleState.centers[i3 + 0] - tempCenter.x;
      const dz = particleState.centers[i3 + 2] - tempCenter.z;
      const distXZ = Math.hypot(dx, dz);

      const expired = particleState.ages[i] >= particleState.lifetimes[i];
      const belowGround = particleState.centers[i3 + 1] < groundY;
      const outsideCylinder =
        distXZ > radius * 1.25 ||
        particleState.centers[i3 + 1] < minY - 1.0 ||
        particleState.centers[i3 + 1] > maxY + 1.0;

      const wayOffscreen =
        tempNdc.z < -1.5 ||
        tempNdc.z > 1.5 ||
        tempNdc.x < -2.0 ||
        tempNdc.x > 2.0 ||
        tempNdc.y < -2.0 ||
        tempNdc.y > 2.0;

      if (expired || belowGround || outsideCylinder || wayOffscreen) {
        spawnParticle(i, true);

        worldPos.set(
          particleState.centers[i3 + 0],
          particleState.centers[i3 + 1],
          particleState.centers[i3 + 2]
        );
      }

      mvPos.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
      const depth = Math.max(0.0001, -mvPos.z);

      // Exact replacement for:
      // gl_PointSize = max(2.0, uSize * (180.0 / -mvPosition.z));
      const pointSizePx = Math.max(2.0, size * (180.0 / depth));

      let halfWorldSize = 0.01;

      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        const fovRad = THREE.MathUtils.degToRad(perspectiveCamera.fov);
        const worldHeightAtDepth = 2 * depth * Math.tan(fovRad * 0.5);
        const worldPerPixel = worldHeightAtDepth / viewportSize.height;
        halfWorldSize = pointSizePx * 0.5 * worldPerPixel;
      } else if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
        const orthoCamera = camera as THREE.OrthographicCamera;
        const worldHeight =
          (orthoCamera.top - orthoCamera.bottom) / orthoCamera.zoom;
        const worldPerPixel = worldHeight / viewportSize.height;
        halfWorldSize = pointSizePx * 0.5 * worldPerPixel;
      }

      particleState.scales[i] = halfWorldSize;

      dummy.position.copy(worldPos);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(halfWorldSize, halfWorldSize, 1);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);

      quadGeometry.instanceAlpha[i] = particleState.alphas[i];
      quadGeometry.instanceColor[i3 + 0] = baseColor.r * bright;
      quadGeometry.instanceColor[i3 + 1] = baseColor.g * bright;
      quadGeometry.instanceColor[i3 + 2] = baseColor.b * bright;
    }

    mesh.instanceMatrix.needsUpdate = true;
    quadGeometry.alphaAttr.needsUpdate = true;
    quadGeometry.colorAttr.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[quadGeometry.geometry, material, count]}
      frustumCulled={false}
      renderOrder={10}
      /*
      userData={{
        cannotReceiveAO: true,
      }}
      */
      layers={layer}
    />
  );
}
