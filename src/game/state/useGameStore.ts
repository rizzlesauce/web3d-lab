import * as THREE from "three";
import { create } from "zustand";

export type GameRefs = {
  player?: THREE.Object3D;
  cameraRig?: THREE.Object3D;
};

type GameState = {
  initialFramesRendered: boolean;
  setInitialFramesRendered: (value: boolean) => void;
  paused: boolean;
  refs: GameRefs;
  setRef: (k: keyof GameRefs, v: THREE.Object3D | undefined) => void;
  togglePaused: () => void;
  hdrPath?: string;
  setHdrPath: (path: string | undefined) => void;
};

export const useGameStore = create<GameState>(set => ({
  initialFramesRendered: false,
  setInitialFramesRendered: (value: boolean) => set({ initialFramesRendered: value }),
  paused: false,
  refs: {},
  setRef: (k, v) => set(s => ({ refs: { ...s.refs, [k]: v } })),
  togglePaused: () => set(s => ({ paused: !s.paused })),
  hdrPath: undefined,
  setHdrPath: (path) => set({ hdrPath: path }),
}));
