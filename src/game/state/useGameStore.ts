import * as THREE from "three/webgpu";
import { create } from "zustand";
import type { Renderer } from "../../render/render";
import { createInput, type InputState } from "../systems/input";

type Updater<T> = T | ((prev: T) => T);

export type GameRefs = {
  player?: THREE.Object3D;
  cameraRig?: THREE.Object3D;
};

type GameState = {
  input: InputState;
  setInput: (input: Updater<InputState>) => void;
  firstFrameRendered: boolean;
  setFirstFrameRendered: (value: boolean) => void;
  initialFramesRendered: boolean;
  setInitialFramesRendered: (value: boolean) => void;
  paused: boolean;
  refs: GameRefs;
  setRef: (k: keyof GameRefs, v: THREE.Object3D | undefined) => void;
  togglePaused: () => void;
  hdrPath?: string;
  setHdrPath: (path: string | undefined) => void;
  scenePass?: THREE.PassNode;
  setScenePass: (pass: THREE.PassNode | undefined) => void;
  renderer?: Renderer;
  setRenderer: (renderer: Renderer | undefined) => void;
  shadowsType?: THREE.ShadowMapType;
  setShadowsType: (type: THREE.ShadowMapType | undefined) => void;
};

export const useGameStore = create<GameState>(set => ({
  input: createInput(),
  setInput: inputOrUpdater => set(s => ({
    input: typeof inputOrUpdater === "function"
      ? inputOrUpdater(s.input)
      : inputOrUpdater
  })),
  firstFrameRendered: false,
  setFirstFrameRendered: value => set({ firstFrameRendered: value }),
  initialFramesRendered: false,
  setInitialFramesRendered: value => set({ initialFramesRendered: value }),
  paused: false,
  refs: {},
  setRef: (k, v) => set(s => ({ refs: { ...s.refs, [k]: v } })),
  togglePaused: () => set(s => ({ paused: !s.paused })),
  hdrPath: undefined,
  setHdrPath: (path) => set({ hdrPath: path }),
  scenePass: undefined,
  setScenePass: (pass) => set({ scenePass: pass }),
  renderer: undefined,
  setRenderer: (renderer) => set({ renderer }),
  shadowsType: THREE.BasicShadowMap,
  setShadowsType: (type) => set({ shadowsType: type }),
}));
