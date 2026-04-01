import * as THREE from 'three/webgpu';
import { asType } from '../utility/types';

export function Ground() {
  const size = 75;

  return (
    <>
      {false && (
        <mesh
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          renderOrder={-1}
        >
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial
            //color="#777777"
            //roughness={1}
            //opacity={0.7}
            //transparent
            colorWrite={false}
            depthWrite
            depthTest
            transparent={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.001, 0]}
        receiveShadow
      >
        <planeGeometry args={[size, size]} />
        {asType<boolean>(false) && (
          <shadowMaterial opacity={0.3} />
        )}
      </mesh>
    </>
  );
}
