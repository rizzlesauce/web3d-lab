import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { RGBELoader } from "three-stdlib";
import {
  asin,
  atan,
  clamp,
  cos,
  float,
  length,
  modelWorldMatrix,
  normalize,
  positionLocal,
  pow,
  sin,
  smoothstep,
  texture,
  uniform,
  uniformTexture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import * as THREE from "three/webgpu";

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

  seamOffset?: number;
  seamPaddingPx?: number;

  // Current safe device limit. Default matches your current error case.
  maxTextureWidth?: number;
};

type SharedProps = {
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
  seamOffset: number;
  seamPaddingPx?: number;
  maxTextureWidth?: number;
};

type DisplacementProps = {
  noisePath: string;
  displacementScale: number;
  displacementTiling: number;
  planeSegments: number;
};

type GroundMaterials = {
  visibleMaterial: THREE.Material;
  shadowMaterial: THREE.Material;
  depthMaterial: THREE.Material;
};

type DataTextureImageLike = {
  data: Uint8Array | Uint16Array | Float32Array;
  width: number;
  height: number;
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
    seamOffset = 0.0,
    seamPaddingPx,
    maxTextureWidth,
  } = props;

  const shared: SharedProps = {
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
    seamOffset,
    seamPaddingPx,
    maxTextureWidth,
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

function HdriGroundPlaneFlat({ shared }: { shared: SharedProps }) {
  const hdrTexture = useLoader(RGBELoader, shared.hdrPath);
  const {
    texture: paddedHdrTexture,
    uScale: envUScale,
    uBias: envUBias,
  } = useSeamPaddedPanoramaTexture(
    hdrTexture,
    shared.maxTextureWidth,
    shared.seamPaddingPx
  );

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(shared.size, shared.size),
    [shared.size]
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const materials = useGroundMaterials({
    hdrTexture: paddedHdrTexture,
    envUScale,
    envUBias,
    actualRadius: shared.actualRadius,
    fadeWidth: shared.fadeWidth,
    projectionHeight: shared.projectionHeight,
    projectionScale: shared.projectionScale,
    projectionCurve: shared.projectionCurve,
    rotation: shared.rotation,
    groundGain: shared.groundGain,
    groundContrast: shared.groundContrast,
    seamOffset: shared.seamOffset,
    shadowOpacity: shared.shadowOpacity,
    usingInvisibleDepthPlane: shared.usingInvisibleDepthPlane,
  });

  useDisposeMaterials(materials);
  useDisposeTexture(paddedHdrTexture);

  return (
    <GroundPlanes
      geometry={geometry}
      y={shared.y}
      usingInvisibleDepthPlane={shared.usingInvisibleDepthPlane}
      visibleMaterial={materials.visibleMaterial}
      shadowMaterial={materials.shadowMaterial}
      depthMaterial={materials.depthMaterial}
    />
  );
}

function HdriGroundPlaneDisplaced({
  shared,
  displacement,
}: {
  shared: SharedProps;
  displacement: DisplacementProps;
}) {
  const hdrTexture = useLoader(RGBELoader, shared.hdrPath);
  const {
    texture: paddedHdrTexture,
    uScale: envUScale,
    uBias: envUBias,
  } = useSeamPaddedPanoramaTexture(
    hdrTexture,
    shared.maxTextureWidth,
    shared.seamPaddingPx
  );
  const noiseTexture = useLoader(THREE.TextureLoader, displacement.noisePath);

  const geometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        shared.size,
        shared.size,
        displacement.planeSegments,
        displacement.planeSegments
      ),
    [shared.size, displacement.planeSegments]
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const materials = useGroundMaterials({
    hdrTexture: paddedHdrTexture,
    envUScale,
    envUBias,
    actualRadius: shared.actualRadius,
    fadeWidth: shared.fadeWidth,
    projectionHeight: shared.projectionHeight,
    projectionScale: shared.projectionScale,
    projectionCurve: shared.projectionCurve,
    rotation: shared.rotation,
    groundGain: shared.groundGain,
    groundContrast: shared.groundContrast,
    seamOffset: shared.seamOffset,
    shadowOpacity: shared.shadowOpacity,
    usingInvisibleDepthPlane: shared.usingInvisibleDepthPlane,
    noiseTexture,
    displacementScale: displacement.displacementScale,
    displacementTiling: displacement.displacementTiling,
  });

  useDisposeMaterials(materials);
  useDisposeTexture(paddedHdrTexture);

  return (
    <GroundPlanes
      geometry={geometry}
      y={shared.y}
      usingInvisibleDepthPlane={shared.usingInvisibleDepthPlane}
      visibleMaterial={materials.visibleMaterial}
      shadowMaterial={materials.shadowMaterial}
      depthMaterial={materials.depthMaterial}
    />
  );
}

function useSeamPaddedPanoramaTexture(
  sourceTexture: THREE.Texture,
  maxTextureWidth?: number,
  paddingPx?: number,
): {
  texture: THREE.DataTexture;
  uScale: number;
  uBias: number;
} {
  return useMemo(() => {
    const image = sourceTexture.image as Partial<DataTextureImageLike> | undefined;

    if (
      !image ||
      typeof image.width !== "number" ||
      typeof image.height !== "number" ||
      !image.data
    ) {
      throw new Error(
        "HdriGroundPlane: expected source texture.image to have width, height, and typed-array data."
      );
    }

    const srcData = image.data;
    const srcWidth = image.width;
    const srcHeight = image.height;

    if (
      !(
        srcData instanceof Uint8Array ||
        srcData instanceof Uint16Array ||
        srcData instanceof Float32Array
      )
    ) {
      throw new Error(
        "HdriGroundPlane: unsupported texture.image.data type. Expected Uint8Array, Uint16Array, or Float32Array."
      );
    }

    if (maxTextureWidth === undefined) {
      maxTextureWidth = srcWidth;
    }

    if (maxTextureWidth < 3) {
      throw new Error("HdriGroundPlane: maxTextureWidth must be at least 3.");
    }

    const texelCount = srcWidth * srcHeight;
    const channels = srcData.length / texelCount;

    if (!Number.isInteger(channels) || channels <= 0) {
      throw new Error(
        "HdriGroundPlane: could not determine channel count from source texture data."
      );
    }

    const desiredPadding =
      paddingPx ?? Math.min(64, Math.max(8, Math.ceil(srcWidth * 0.002)));

    // Clamp padding so there is always at least 1 center texel.
    const P = Math.max(0, Math.min(desiredPadding, Math.floor((maxTextureWidth - 1) / 2)));

    // Width available for the center panorama after padding.
    const centerWidth = Math.max(1, Math.min(srcWidth, maxTextureWidth - 2 * P));
    const paddedWidth = centerWidth + 2 * P;

    let resizedCenterData: Uint8Array | Uint16Array | Float32Array;
    if (srcData instanceof Float32Array) {
      resizedCenterData = new Float32Array(centerWidth * srcHeight * channels);
    } else if (srcData instanceof Uint16Array) {
      resizedCenterData = new Uint16Array(centerWidth * srcHeight * channels);
    } else {
      resizedCenterData = new Uint8Array(centerWidth * srcHeight * channels);
    }

    const srcRowStride = srcWidth * channels;
    const centerRowStride = centerWidth * channels;

    // Horizontal linear resample into the center width.
    for (let y = 0; y < srcHeight; y++) {
      const srcRowBase = y * srcRowStride;
      const dstRowBase = y * centerRowStride;

      for (let x = 0; x < centerWidth; x++) {
        const srcX =
          centerWidth === 1 ? 0 : (x * (srcWidth - 1)) / (centerWidth - 1);

        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, srcWidth - 1);
        const t = srcX - x0;

        for (let c = 0; c < channels; c++) {
          const v0 = srcData[srcRowBase + x0 * channels + c];
          const v1 = srcData[srcRowBase + x1 * channels + c];
          const value = v0 + (v1 - v0) * t;

          resizedCenterData[dstRowBase + x * channels + c] =
            resizedCenterData instanceof Float32Array
              ? value
              : Math.round(value);
        }
      }
    }

    let paddedData: Uint8Array | Uint16Array | Float32Array;
    if (resizedCenterData instanceof Float32Array) {
      paddedData = new Float32Array(paddedWidth * srcHeight * channels);
    } else if (resizedCenterData instanceof Uint16Array) {
      paddedData = new Uint16Array(paddedWidth * srcHeight * channels);
    } else {
      paddedData = new Uint8Array(paddedWidth * srcHeight * channels);
    }

    const paddedRowStride = paddedWidth * channels;
    const padStride = P * channels;

    for (let row = 0; row < srcHeight; row++) {
      const centerRowBase = row * centerRowStride;
      const paddedRowBase = row * paddedRowStride;

      const centerRow = resizedCenterData.subarray(
        centerRowBase,
        centerRowBase + centerRowStride
      );

      // Left pad from tail of resized center row.
      const leftPad =
        P > 0
          ? resizedCenterData.subarray(
              centerRowBase + (centerWidth - P) * channels,
              centerRowBase + centerWidth * channels
            )
          : null;

      // Right pad from head of resized center row.
      const rightPad =
        P > 0
          ? resizedCenterData.subarray(
              centerRowBase,
              centerRowBase + padStride
            )
          : null;

      if (leftPad) paddedData.set(leftPad, paddedRowBase);
      paddedData.set(centerRow, paddedRowBase + padStride);
      if (rightPad) paddedData.set(rightPad, paddedRowBase + padStride + centerRowStride);
    }

    const paddedTexture = new THREE.DataTexture(paddedData, paddedWidth, srcHeight);

    paddedTexture.format = sourceTexture.format;
    paddedTexture.type = sourceTexture.type;
    paddedTexture.mapping = sourceTexture.mapping;
    paddedTexture.colorSpace = sourceTexture.colorSpace;
    paddedTexture.anisotropy = sourceTexture.anisotropy;

    paddedTexture.wrapS = THREE.ClampToEdgeWrapping;
    paddedTexture.wrapT = THREE.ClampToEdgeWrapping;
    paddedTexture.minFilter = THREE.LinearFilter;
    paddedTexture.magFilter = THREE.LinearFilter;

    paddedTexture.generateMipmaps = false;
    paddedTexture.flipY = sourceTexture.flipY;
    paddedTexture.unpackAlignment = sourceTexture.unpackAlignment;
    paddedTexture.needsUpdate = true;

    const uScale = centerWidth / paddedWidth;
    const uBias = P / paddedWidth;

    return {
      texture: paddedTexture,
      uScale,
      uBias,
    };
  }, [sourceTexture, maxTextureWidth, paddingPx]);
}

function useGroundMaterials({
  hdrTexture,
  envUScale,
  envUBias,
  actualRadius,
  fadeWidth,
  projectionHeight,
  projectionScale,
  projectionCurve,
  rotation,
  groundGain,
  groundContrast,
  seamOffset,
  shadowOpacity,
  usingInvisibleDepthPlane,
  noiseTexture,
  displacementScale = 0.35,
  displacementTiling = 0.06,
}: {
  hdrTexture: THREE.Texture;
  envUScale: number;
  envUBias: number;
  actualRadius: number;
  fadeWidth: number;
  projectionHeight: number;
  projectionScale: number;
  projectionCurve: number;
  rotation: number;
  groundGain: number;
  groundContrast: number;
  seamOffset: number;
  shadowOpacity: number;
  usingInvisibleDepthPlane: boolean;
  noiseTexture?: THREE.Texture;
  displacementScale?: number;
  displacementTiling?: number;
}): GroundMaterials {
  return useMemo(() => {
    hdrTexture.colorSpace = THREE.LinearSRGBColorSpace;
    hdrTexture.wrapS = THREE.ClampToEdgeWrapping;
    hdrTexture.wrapT = THREE.ClampToEdgeWrapping;
    hdrTexture.generateMipmaps = false;
    hdrTexture.minFilter = THREE.LinearFilter;
    hdrTexture.magFilter = THREE.LinearFilter;
    hdrTexture.needsUpdate = true;

    if (noiseTexture) {
      noiseTexture.colorSpace = THREE.NoColorSpace;
      noiseTexture.wrapS = THREE.RepeatWrapping;
      noiseTexture.wrapT = THREE.RepeatWrapping;
      noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
      noiseTexture.magFilter = THREE.LinearFilter;
      noiseTexture.needsUpdate = true;
    }

    const uRadius = uniform(actualRadius);
    const uFadeWidth = uniform(fadeWidth);
    const uProjectionHeight = uniform(projectionHeight);
    const uProjectionScale = uniform(projectionScale);
    const uProjectionCurve = uniform(projectionCurve);
    const uRotation = uniform(-rotation);
    const uCenter = uniform(new THREE.Vector2(0, 0));
    const uGroundGain = uniform(groundGain);
    const uGroundContrast = uniform(groundContrast);
    const uSeamOffset = uniform(seamOffset);
    const uEnvUScale = uniform(envUScale);
    const uEnvUBias = uniform(envUBias);

    const uEnvMap = uniformTexture(hdrTexture);

    const displacedLocalPosition = noiseTexture
      ? (() => {
          const uDispMap = uniformTexture(noiseTexture);
          const uDispScale = uniform(displacementScale);
          const uDispTiling = uniform(displacementTiling);

          const groundUv = positionLocal.xz.mul(uDispTiling);
          const disp = texture(uDispMap, groundUv).r.sub(0.5).mul(2.0);

          return positionLocal.add(vec3(0.0, 0.0, disp.mul(uDispScale)));
        })()
      : positionLocal;

    const displacedWorldPositionNode = modelWorldMatrix
      .mul(vec4(displacedLocalPosition, 1.0))
      .xyz;

    const vWorldPosition = displacedWorldPositionNode.toVarying("vWorldPosition");

    const pUnrotated = vWorldPosition.xz.sub(uCenter).mul(uProjectionScale);
    const dist = length(pUnrotated);

    const c = cos(uRotation);
    const s = sin(uRotation);

    const p = vec2(
      c.mul(pUnrotated.x).sub(s.mul(pUnrotated.y)),
      s.mul(pUnrotated.x).add(c.mul(pUnrotated.y))
    );

    const r = clamp(dist.div(uRadius), 0.0, 1.0);
    const rWarp = pow(r, uProjectionCurve);

    const pLen = length(p).max(1e-5);
    const warpScale = rWarp.mul(uRadius).mul(uProjectionScale);
    const warped = p.div(pLen).mul(warpScale);

    const dir = normalize(vec3(warped.x, uProjectionHeight.negate(), warped.y));

    const PI = Math.PI;
    const envUv = vec2(
      atan(dir.z, dir.x).div(2.0 * PI).add(0.5),
      asin(clamp(dir.y, -1.0, 1.0)).div(PI).add(0.5)
    );

    const envUvPadded = vec2(
      envUv.x.mul(uEnvUScale).add(uEnvUBias).add(uSeamOffset.mul(uEnvUScale)),
      envUv.y
    );

    const projectedColor = texture(uEnvMap, envUvPadded)
      .rgb
      .mul(uGroundGain)
      .sub(0.5)
      .mul(uGroundContrast)
      .add(0.5)
      .clamp(0.0, 1.0);

    const edgeAlpha = float(1.0).sub(
      smoothstep(uRadius.sub(uFadeWidth), uRadius, dist)
    );

    const visibleMaterial = new THREE.MeshBasicNodeMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: !usingInvisibleDepthPlane,
      toneMapped: true,
    });
    visibleMaterial.positionNode = displacedLocalPosition;
    visibleMaterial.colorNode = projectedColor;
    visibleMaterial.opacityNode = edgeAlpha;

    const shadowMaterial = new THREE.ShadowNodeMaterial({
      transparent: true,
      opacity: shadowOpacity,
      depthWrite: false,
    });
    shadowMaterial.positionNode = displacedLocalPosition;

    const depthMaterial = new THREE.MeshBasicNodeMaterial({
      side: THREE.DoubleSide,
      transparent: false,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
    });
    depthMaterial.positionNode = displacedLocalPosition;

    return {
      visibleMaterial,
      shadowMaterial,
      depthMaterial,
    };
  }, [
    hdrTexture,
    envUScale,
    envUBias,
    actualRadius,
    fadeWidth,
    projectionHeight,
    projectionScale,
    projectionCurve,
    rotation,
    groundGain,
    groundContrast,
    seamOffset,
    shadowOpacity,
    usingInvisibleDepthPlane,
    noiseTexture,
    displacementScale,
    displacementTiling,
  ]);
}

function useDisposeMaterials({
  visibleMaterial,
  shadowMaterial,
  depthMaterial,
}: GroundMaterials) {
  useEffect(() => {
    return () => {
      visibleMaterial.dispose();
      shadowMaterial.dispose();
      depthMaterial.dispose();
    };
  }, [visibleMaterial, shadowMaterial, depthMaterial]);
}

function useDisposeTexture(textureToDispose: THREE.Texture) {
  useEffect(() => {
    return () => {
      textureToDispose.dispose();
    };
  }, [textureToDispose]);
}

function GroundPlanes({
  geometry,
  y,
  usingInvisibleDepthPlane,
  visibleMaterial,
  shadowMaterial,
  depthMaterial,
}: {
  geometry: THREE.PlaneGeometry;
  y: number;
  usingInvisibleDepthPlane: boolean;
  visibleMaterial: THREE.Material;
  shadowMaterial: THREE.Material;
  depthMaterial: THREE.Material;
}) {
  return (
    <>
      {usingInvisibleDepthPlane && (
        <mesh
          geometry={geometry}
          dispose={null}
          rotation-x={-Math.PI / 2}
          position={[0, y - 0.001, 0]}
          renderOrder={-1}
          material={depthMaterial}
        />
      )}

      <mesh
        geometry={geometry}
        dispose={null}
        rotation-x={-Math.PI / 2}
        position={[0, y, 0]}
        renderOrder={0}
        material={visibleMaterial}
      />

      <mesh
        geometry={geometry}
        dispose={null}
        rotation-x={-Math.PI / 2}
        position={[0, y + 0.001, 0]}
        receiveShadow
        renderOrder={1}
        material={shadowMaterial}
      />
    </>
  );
}
