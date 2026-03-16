import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { SandboxScene } from './scenes/SandboxScene';
import { useGameStore } from './state/useGameStore';
import { makeFixedStep, stepFixed } from './systems/time';

export function GameRoot() {
  const paused = useGameStore((s) => s.paused);
  const fs = useMemo(() => makeFixedStep(1 / 60, 6), []);

  // later: bind input here, init systems, etc.
  useEffect(() => {
    // bindKeyboard(input) etc.
  }, []);

  useFrame((_state, frameDt) => {
    if (paused) {
        return;
    }

    stepFixed(fs, frameDt, (_dt) => {
      // tick systems here in a stable order
      // playerController(dt)
      // cameraRig(dt)
      // interactions(dt)
    });
  });

  return <SandboxScene />;
}
