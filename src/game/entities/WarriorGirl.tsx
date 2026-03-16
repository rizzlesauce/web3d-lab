import { Model, type ModelTransformProps } from "./Model";

export function WarriorGirl(props: ModelTransformProps) {
  return (
    <Model
      modelPath="/models/warrior_girl.glb"
      {...props}
    />
  );
}
