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

export function bindKeyboard(input: InputState) {
  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW':
        input.forward = down;
        break;
      case 'KeyS':
        input.back = down;
        break;
      case 'KeyA':
        input.left = down;
        break;
      case 'KeyD':
        input.right = down;
        break;
      case 'Space':
        input.jump = down;
        break;
      case 'ShiftLeft':
        input.sprint = down;
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
  const onMove = (_e: MouseEvent) => {
    // store deltas wherever you keep input; or route into store
  };
  window.addEventListener('mousemove', onMove);
  return () => window.removeEventListener('mousemove', onMove);
}
