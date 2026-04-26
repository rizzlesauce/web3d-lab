import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  attribute,
  depth,
  float,
  screenUV,
  smoothstep,
  texture,
  uniform,
  uv,
} from "three/tsl";
import * as THREE from "three/webgpu";

type AtmospherePollenCylinderProps = {
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

  // Separate layers for the two render proxies
  layer?: number;
  layer2?: number;

  sceneDepthNode?: THREE.TextureNode | null;
};

const timer = new THREE.Timer();

type PollenGeometryState = {
  geometry: THREE.PlaneGeometry;
  alphaAttr: THREE.InstancedBufferAttribute;
  colorAttr: THREE.InstancedBufferAttribute;
  instanceAlpha: Float32Array;
  instanceColor: Float32Array;
};

type PollenParticleState = {
  centers: Float32Array;
  velocities: Float32Array;
  ages: Float32Array;
  spawnAges: Float32Array;
  lifetimes: Float32Array;
  seeds: Float32Array;
  swayAmp: Float32Array;
  swayFreq: Float32Array;
  scales: Float32Array;
  alphas: Float32Array;
  brightness: Float32Array;
};

type PollenCore = {
  count: number;
  sprite: THREE.Texture;
  geometry: THREE.PlaneGeometry;
  setMeshRef: (mesh: THREE.InstancedMesh | null) => void;
  setCubeMeshRef: (mesh: THREE.InstancedMesh | null) => void;
};

function createPollenGeometryState(count: number): PollenGeometryState {
  const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);

  const instanceAlpha = new Float32Array(count);
  const instanceColor = new Float32Array(count * 3);

  const alphaAttr = new THREE.InstancedBufferAttribute(instanceAlpha, 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);

  const colorAttr = new THREE.InstancedBufferAttribute(instanceColor, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute("instanceAlpha", alphaAttr);
  geometry.setAttribute("instanceColor", colorAttr);

  return {
    geometry,
    alphaAttr,
    colorAttr,
    instanceAlpha,
    instanceColor,
  };
}

function createPollenParticleState(count: number): PollenParticleState {
  return {
    centers: new Float32Array(count * 3),
    velocities: new Float32Array(count * 3),
    ages: new Float32Array(count),
    spawnAges: new Float32Array(count),
    lifetimes: new Float32Array(count),
    seeds: new Float32Array(count),
    swayAmp: new Float32Array(count),
    swayFreq: new Float32Array(count),
    scales: new Float32Array(count),
    alphas: new Float32Array(count),
    brightness: new Float32Array(count),
  };
}

function randomPointInCylinder(
  centerX: number,
  centerZ: number,
  radius: number,
  minY: number,
  maxY: number
) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;

  return {
    x: centerX + Math.cos(angle) * r,
    y: THREE.MathUtils.randFloat(minY, maxY),
    z: centerZ + Math.sin(angle) * r,
  };
}

function spawnParticle(
  particleState: PollenParticleState,
  index: number,
  centerX: number,
  centerZ: number,
  radius: number,
  minY: number,
  maxY: number,
  baseWind: [number, number, number],
  midLife = true
) {
  const point = randomPointInCylinder(centerX, centerZ, radius, minY, maxY);
  const offset = index * 3;

  particleState.centers[offset + 0] = point.x;
  particleState.centers[offset + 1] = point.y;
  particleState.centers[offset + 2] = point.z;

  particleState.velocities[offset + 0] =
    baseWind[0] + THREE.MathUtils.randFloat(-0.02, 0.02);
  particleState.velocities[offset + 1] =
    baseWind[1] + THREE.MathUtils.randFloat(-0.03, 0.01);
  particleState.velocities[offset + 2] =
    baseWind[2] + THREE.MathUtils.randFloat(-0.02, 0.02);

  particleState.lifetimes[index] = THREE.MathUtils.randFloat(6, 12);
  particleState.ages[index] = midLife
    ? THREE.MathUtils.randFloat(0, particleState.lifetimes[index] * 0.7)
    : 0;

  particleState.spawnAges[index] = 0;
  particleState.seeds[index] = Math.random() * 1000;
  particleState.swayAmp[index] = THREE.MathUtils.randFloat(0.02, 0.07);
  particleState.swayFreq[index] = THREE.MathUtils.randFloat(0.35, 0.9);

  particleState.alphas[index] = 0;
  particleState.brightness[index] = 1;
  particleState.scales[index] = 0.01;
}

function useAtmospherePollenCore({
  count = 260,
  texturePath = "/particle_sprite_soft_warm.png",
  color = "#fff4c8",
  size = 18,

  radius = 12,
  minY = 0.5,
  maxY = 8,
  groundY = 0.05,
  fadeY = 0.2,

  baseWind = [0.035, -0.06, 0.01],
  sunlightDirection = new THREE.Vector3(-8, -12, -6),
  sunGlowStrength = 1.2,
  spawnFadeInTime = 1.0,
}: Omit<
  AtmospherePollenCylinderProps,
  "layer" | "layer2" | "sceneDepthNode" | "opacity"
>): PollenCore {
  const camera = useThree((s) => s.camera);
  const viewportSize = useThree((s) => s.size);

  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const cubeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const geometryStateRef = useRef<PollenGeometryState | null>(null);
  const particleStateRef = useRef<PollenParticleState | null>(null);
  const tempNdcRef = useRef(new THREE.Vector3());
  const tempToCameraRef = useRef(new THREE.Vector3());
  const tempCenterRef = useRef(new THREE.Vector3());
  const worldPosRef = useRef(new THREE.Vector3());
  const mvPosRef = useRef(new THREE.Vector3());
  const dummyRef = useRef(new THREE.Object3D());

  const loadedSprite = useLoader(THREE.TextureLoader, texturePath);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const sunlightDir = useMemo(
    () => sunlightDirection.clone().normalize(),
    [sunlightDirection]
  );

  const setMeshRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    meshRef.current = mesh;
  }, []);

  const setCubeMeshRef = useCallback((mesh: THREE.InstancedMesh | null) => {
    cubeMeshRef.current = mesh;
  }, []);

  const renderResources = useMemo(() => {
    const sprite = loadedSprite.clone();
    sprite.colorSpace = THREE.SRGBColorSpace;
    sprite.wrapS = THREE.ClampToEdgeWrapping;
    sprite.wrapT = THREE.ClampToEdgeWrapping;
    sprite.needsUpdate = true;

    return {
      count,
      sprite,
      geometryState: createPollenGeometryState(count),
      particleState: createPollenParticleState(count),
    };
  }, [count, loadedSprite]);

  const core = useMemo(
    () => ({
      count: renderResources.count,
      sprite: renderResources.sprite,
      geometry: renderResources.geometryState.geometry,
      setMeshRef,
      setCubeMeshRef,
    }),
    [renderResources, setCubeMeshRef, setMeshRef]
  );

  useEffect(() => {
    geometryStateRef.current = renderResources.geometryState;
    particleStateRef.current = renderResources.particleState;

    const geometryState = geometryStateRef.current;
    const particleState = particleStateRef.current;

    if (!geometryState || !particleState) {
      return;
    }

    for (let i = 0; i < count; i++) {
      spawnParticle(
        particleState,
        i,
        camera.position.x,
        camera.position.z,
        radius,
        minY,
        maxY,
        baseWind,
        true
      );
    }

    geometryState.alphaAttr.needsUpdate = true;
    geometryState.colorAttr.needsUpdate = true;

    return () => {
      if (geometryStateRef.current === geometryState) {
        geometryStateRef.current = null;
      }
      if (particleStateRef.current === particleState) {
        particleStateRef.current = null;
      }

      renderResources.sprite.dispose();
      renderResources.geometryState.geometry.dispose();
    };
  }, [
    baseWind,
    camera,
    count,
    maxY,
    minY,
    radius,
    renderResources,
  ]);

  useFrame((_state, delta) => {
    const geometryState = geometryStateRef.current;
    const particleState = particleStateRef.current;
    const mesh = meshRef.current;
    const cubeMesh = cubeMeshRef.current;

    if (!geometryState || !particleState || (!mesh && !cubeMesh)) {
      return;
    }

    const tempNdc = tempNdcRef.current;
    const tempToCamera = tempToCameraRef.current;
    const tempCenter = tempCenterRef.current;
    const worldPos = worldPosRef.current;
    const mvPos = mvPosRef.current;
    const dummy = dummyRef.current;

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
        spawnParticle(
          particleState,
          i,
          camera.position.x,
          camera.position.z,
          radius,
          minY,
          maxY,
          baseWind,
          true
        );

        worldPos.set(
          particleState.centers[i3 + 0],
          particleState.centers[i3 + 1],
          particleState.centers[i3 + 2]
        );
      }

      mvPos.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
      const viewDepth = Math.max(0.0001, -mvPos.z);

      const pointSizePx = Math.max(2.0, size * (180.0 / viewDepth));

      let halfWorldSize = 0.01;

      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        const fovRad = THREE.MathUtils.degToRad(perspectiveCamera.fov);
        const worldHeightAtDepth = 2 * viewDepth * Math.tan(fovRad * 0.5);
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

      if (mesh) mesh.setMatrixAt(i, dummy.matrix);
      if (cubeMesh) cubeMesh.setMatrixAt(i, dummy.matrix);

      geometryState.instanceAlpha[i] = particleState.alphas[i];
      geometryState.instanceColor[i3 + 0] = baseColor.r * bright;
      geometryState.instanceColor[i3 + 1] = baseColor.g * bright;
      geometryState.instanceColor[i3 + 2] = baseColor.b * bright;
    }

    if (mesh) mesh.instanceMatrix.needsUpdate = true;
    if (cubeMesh) cubeMesh.instanceMatrix.needsUpdate = true;

    geometryState.alphaAttr.needsUpdate = true;
    geometryState.colorAttr.needsUpdate = true;
  });

  return core;
}

function useAtmospherePollenMaterial(
  sprite: THREE.Texture,
  opacity: number,
  sceneDepthNode?: THREE.TextureNode | null
) {
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

    mat.colorNode = tex.rgb.mul(instanceColor);

    const baseOpacity = tex.a.mul(instanceAlpha).mul(opacityUniform);

    if (sceneDepthNode) {
      const opaqueDepth = sceneDepthNode.sample(screenUV).r;
      const particleDepth = depth;

      const depthBias = float(0.0015);
      const depthFeather = float(0.003);

      const visibleMask = smoothstep(
        particleDepth.sub(depthBias),
        particleDepth.add(depthFeather),
        opaqueDepth
      );

      mat.opacityNode = baseOpacity.mul(visibleMask);
    } else {
      mat.opacityNode = baseOpacity;
    }

    return mat;
  }, [sprite, opacity, sceneDepthNode]);

  return material;
}

export function AtmospherePollenCylinderSingle({
  core,
  meshRef,
  layer,
  opacity = 0.6,
  sceneDepthNode = null,
}: {
  core: PollenCore;
  meshRef: (mesh: THREE.InstancedMesh | null) => void;
  layer: number;
  opacity: number;
  sceneDepthNode?: THREE.TextureNode | null;
}) {
  const material = useAtmospherePollenMaterial(
    core.sprite,
    opacity,
    sceneDepthNode
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[core.geometry, material, core.count]}
      dispose={null}
      frustumCulled={false}
      //renderOrder={10}
      layers={layer}
    />
  );
}

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

  layer = 1,
  layer2,
  sceneDepthNode = null,
}: AtmospherePollenCylinderProps) {
  const core = useAtmospherePollenCore({
    count,
    texturePath,
    color,
    size,
    radius,
    minY,
    maxY,
    groundY,
    fadeY,
    baseWind,
    sunlightDirection,
    sunGlowStrength,
    spawnFadeInTime,
  });

  return (
    <>
      <AtmospherePollenCylinderSingle
        core={core}
        meshRef={core.setMeshRef}
        layer={layer}
        opacity={opacity}
        sceneDepthNode={sceneDepthNode}
      />

      {layer2 !== undefined && (
        <AtmospherePollenCylinderSingle
          core={core}
          meshRef={core.setCubeMeshRef}
          layer={layer2}
          opacity={opacity}
          sceneDepthNode={null}
        />
      )}
    </>
  );
}
