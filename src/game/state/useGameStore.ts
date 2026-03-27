import * as THREE from "three/webgpu";
import { create } from "zustand";
import { createInput, type InputState } from "../systems/input";

type Updater<T> = T | ((prev: T) => T);

export type GameRefs = {
  player?: THREE.Object3D;
  cameraRig?: THREE.Object3D;
};

type GameState = {
  input: InputState;
  setInput: (input: Updater<InputState>) => void;
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
  input: createInput(),
  setInput: inputOrUpdater => set(s => ({
    input: typeof inputOrUpdater === "function"
      ? inputOrUpdater(s.input)
      : inputOrUpdater
  })),
  initialFramesRendered: false,
  setInitialFramesRendered: value => set({ initialFramesRendered: value }),
  paused: false,
  refs: {},
  setRef: (k, v) => set(s => ({ refs: { ...s.refs, [k]: v } })),
  togglePaused: () => set(s => ({ paused: !s.paused })),
  hdrPath: undefined,
  setHdrPath: (path) => set({ hdrPath: path }),
}));
