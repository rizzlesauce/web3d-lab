import { Model, type ModelTransformProps } from "./Model";

export function Woman(props: ModelTransformProps) {
  return (
    <Model
      modelPath="/models/woman_model.glb"
      {...props}
    />
  );
}
