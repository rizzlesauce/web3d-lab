import * as THREE from 'three/webgpu';

export type RendererShadowMapLike = {
  enabled: boolean;
  type: THREE.ShadowMapType;
  autoUpdate: boolean;
};

export type RendererBackendLike = {
  isWebGPUBackend?: boolean;
  isWebGLBackend?: boolean;
  constructor: {
    name: string;
  };
};

export type RendererWithShadowMap = THREE.Renderer & {
  shadowMap: RendererShadowMapLike;
};

export type Renderer = RendererWithShadowMap & {
  autoClear: boolean;
  autoClearDepth: boolean;
  autoClearStencil: boolean;
  backend: RendererBackendLike;
};
