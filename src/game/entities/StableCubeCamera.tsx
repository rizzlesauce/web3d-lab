import * as React from 'react'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useCallback } from 'react'
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'

type CubeCameraOptions = {
  resolution?: number
  near?: number
  far?: number
  envMap?: THREE.Texture | null
  fog?: THREE.Fog | THREE.FogExp2 | null

  /**
   * If provided, the cube camera will not render this layer.
   * You can put the reflective mesh on this layer instead of hiding it.
   */
  excludeLayer?: number

  /**
   * If true, temporarily disables renderer shadow-map auto updates
   * during cube capture.
   */
  disableShadowsDuringCapture?: boolean

  autoClearDuringCapture?: boolean
}

export function useStableCubeCamera({
  resolution = 256,
  near = 0.1,
  far = 1000,
  envMap = null,
  fog = null,
  excludeLayer,
  disableShadowsDuringCapture = false,
  autoClearDuringCapture = false,
}: CubeCameraOptions = {}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  const fbo = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(resolution)
    rt.texture.type = THREE.HalfFloatType
    return rt
  }, [resolution])

  useEffect(() => {
    return () => {
      fbo.dispose()
    }
  }, [fbo])

  const camera = useMemo(() => {
    const cam = new THREE.CubeCamera(near, far, fbo)
    if (excludeLayer !== undefined) {
      cam.layers.enableAll()
      cam.layers.disable(excludeLayer)
    }
    return cam
  }, [near, far, fbo, excludeLayer])

  const update = useCallback(() => {
    const originalFog = scene.fog
    const originalBackground = scene.background
    const originalShadowAutoUpdate = gl.shadowMap.autoUpdate
    const originalAutoClear = gl.autoClear

    scene.background = envMap ?? originalBackground
    scene.fog = fog ?? originalFog

    if (disableShadowsDuringCapture) {
      gl.shadowMap.autoUpdate = false
    }

    if (autoClearDuringCapture) {
      gl.autoClear = true
    }

    camera.update(gl, scene)

    gl.autoClear = originalAutoClear
    gl.shadowMap.autoUpdate = originalShadowAutoUpdate
    scene.fog = originalFog
    scene.background = originalBackground
  }, [gl, scene, camera, envMap, fog, disableShadowsDuringCapture, autoClearDuringCapture])

  return { fbo, camera, update }
}

type StableCubeCameraProps = Omit<ThreeElements['group'], 'children'> & {
  children?: (tex: THREE.Texture) => React.ReactNode
  useVisibilityHide?: boolean
  /**
   * Higher numbers run later in the frame.
   * Use a value > animated object updates so the probe captures final transforms.
   */
  renderPriority?: number

  firstFrame?: number

  /**
   * Update every N frames. 1 = every frame.
   */
  frameInterval?: number
} & CubeCameraOptions

function setLayerRecursive(obj: THREE.Object3D, layer: number) {
  obj.traverse((child) => {
    child.layers.disableAll()
    child.layers.enable(layer)
  })
}

export function StableCubeCamera({
  children,
  resolution,
  near,
  far,
  envMap,
  fog,
  excludeLayer,
  disableShadowsDuringCapture = false,
  autoClearDuringCapture = false,
  useVisibilityHide = excludeLayer === undefined,
  renderPriority,
  firstFrame = 3,
  frameInterval = 1,
  ...props
}: StableCubeCameraProps) {
  const ref = useRef<THREE.Group>(null)
  const count = useRef(0)

  const { fbo, camera, update } = useStableCubeCamera({
    resolution,
    near,
    far,
    envMap,
    fog,
    excludeLayer,
    disableShadowsDuringCapture,
    autoClearDuringCapture,
  })

  useEffect(() => {
    if (excludeLayer !== undefined && ref.current) {
      setLayerRecursive(ref.current, excludeLayer)
    }
  }, [excludeLayer])

  useFrame(() => {
    if (!ref.current) {
      return
    }

    const currentCount = ++count.current
    if (currentCount !== firstFrame && (frameInterval === 0 || currentCount % frameInterval !== 0)) {
      return
    }

    if (useVisibilityHide) {
      ref.current.visible = false
      update()
      ref.current.visible = true
    } else {
      update()
    }
  })

  return (
    <group {...props}>
      <primitive object={camera} />
      <group ref={ref}>{children?.(fbo.texture)}</group>
    </group>
  )
}
