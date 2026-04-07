import { type ThreeElements } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

type RecompilingMeshStandardMaterialProps = ThreeElements['meshStandardMaterial']

const envNodeIdentityMap = new WeakMap<object, number>()
let nextEnvNodeIdentity = 1

function getEnvNodeMaterialKey(envNode: THREE.Node | Readonly<THREE.Node | null | undefined>, prefix = 'recompiling-mesh-standard-material') {
  if (!envNode) {
    return `${prefix}-pending`
  }

  let identity = envNodeIdentityMap.get(envNode)
  if (identity === undefined) {
    identity = nextEnvNodeIdentity
    nextEnvNodeIdentity += 1
    envNodeIdentityMap.set(envNode, identity)
  }

  return `${prefix}-${identity}`
}

export function RecompilingMeshStandardMaterial({
  envNode,
  ...props
}: RecompilingMeshStandardMaterialProps) {
  return (
    <meshStandardMaterial
      key={getEnvNodeMaterialKey(envNode)}
      envNode={envNode}
      {...props}
    />
  )
}
