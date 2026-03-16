export type FixedStep = {
  // fixed delta seconds, e.g. 1/60
  dt: number;
  accumulator: number;
  // safety cap
  maxSubSteps: number;
};

export function makeFixedStep(
  dt = 1 / 60,
  maxSubSteps = 5,
): FixedStep {
  return {
    dt,
    accumulator: 0,
    maxSubSteps,
  };
}

export function stepFixed(
  fs: FixedStep,
  frameDt: number,
  tick: (dt: number) => void,
  fixed: boolean = true,
) {
  fs.accumulator += frameDt;

  // Prevent spiral of death if tab was inactive
  const maxAcc = fs.dt * fs.maxSubSteps;
  if (fs.accumulator > maxAcc) {
    fs.accumulator = maxAcc;
  }

  if (fixed) {
    while (fs.accumulator >= fs.dt) {
      tick(fs.dt);
      fs.accumulator -= fs.dt;
    }
  } else {
    tick(frameDt);
  }
}
