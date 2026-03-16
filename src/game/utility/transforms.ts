import * as THREE from "three";

export function rotateY(
  position: THREE.Vector3,
  angle: number,
): THREE.Vector3 {
  const v = position.clone();
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  return v;
}
