import { Model, type ModelTransformProps } from "./Model";

export function OldTree(props: ModelTransformProps) {
  return (
    <Model
      modelPath="/models/old_tree.glb"
      {...props}
    />
  );
}
