import { Model, type ModelTransformProps } from "./Model";

export function Truck(props: ModelTransformProps) {
  return (
    <Model
      modelPath="/models/2024_gmc_sierra_1500_at4x.glb"
      {...props}
    />
  );
}
