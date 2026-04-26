import * as THREE from 'three/webgpu';

export function enableShadows(obj: THREE.Object3D) {
  obj.traverse(child => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
