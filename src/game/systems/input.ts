import type { Dispatch, SetStateAction } from "react";

export type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  mouseDx: number;
  mouseDy: number;
  consumeMouseDelta: () => { dx: number; dy: number };
};

export function createInput(): InputState {
  let mouseDx = 0, mouseDy = 0;

  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    mouseDx: 0,
    mouseDy: 0,
    consumeMouseDelta() {
      const dx = mouseDx, dy = mouseDy;
      mouseDx = 0; mouseDy = 0;
      return { dx, dy };
    },
  };
}

export function bindKeyboard(setInput: Dispatch<SetStateAction<InputState>>) {
  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
        setInput(input => ({ ...input, forward: down }));
        break;
      case 'KeyS':
        setInput(input => ({ ...input, back: down }));
        break;
      case 'KeyA':
        setInput(input => ({ ...input, left: down }));
        break;
      case 'KeyD':
        setInput(input => ({ ...input, right: down }));
        break;
      case 'Space':
        setInput(input => ({ ...input, jump: down }));
        break;
      case 'ShiftLeft':
        setInput(input => ({ ...input, sprint: down }));
        break;
    }
  };

  const onKeyDown = onKey(true);
  const onKeyUp = onKey(false);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

export function bindMouseLook() {
  // optional: pointer lock later
  const onMove = () => {
    // store deltas wherever you keep input; or route into store
  };

  window.addEventListener('mousemove', onMove);
  return () => window.removeEventListener('mousemove', onMove);
}
