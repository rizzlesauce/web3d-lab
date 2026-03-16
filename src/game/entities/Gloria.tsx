import { Model, type ModelTransformProps } from "./Model";

export function Gloria(props: ModelTransformProps) {
  return (
    <Model
      modelPath="/models/gloria_export.glb"
      {...props}
    />
  );
}
