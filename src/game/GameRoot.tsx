import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { SandboxScene } from './scenes/SandboxScene';
import { useGameStore } from './state/useGameStore';
import { makeFixedStep, stepFixed } from './systems/time';

export function GameRoot() {
  const paused = useGameStore((s) => s.paused);
  const clock = useThree((state) => state.clock);
  const invalidate = useThree((state) => state.invalidate);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is inactive - pause animations/loop
        if (clock.running) {
          clock.stop();
        }
      } else {
        // Tab is active - resume
        if (!paused && !clock.running) {
          clock.start();
          // If using frameloop="demand", force a render
          if (false) {
            invalidate();
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [clock, invalidate, paused]);

  useEffect(() => {
    if (paused) {
      if (clock.running) {
        clock.stop();
      }
    } else {
      if (!clock.running) {
        clock.start();
      }
    }
  }, [paused, clock]);

  return <SandboxScene />;
}
