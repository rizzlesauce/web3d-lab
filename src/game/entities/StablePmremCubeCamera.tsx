import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

type SupportedEnvMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

type CubeCameraOptions = {
  resolution?: number
  near?: number
  far?: number
  envMap?: THREE.Texture | null
  fog?: THREE.Fog | THREE.FogExp2 | null

  /**
   * If provided, the cube camera will not render this layer.
   * Put the reflective object on this layer instead of hiding it.
   */
  excludeLayer?: number

  /**
   * If true, temporarily disables renderer shadow-map auto updates
   * during cube capture.
   */
  disableShadowsDuringCapture?: boolean

  /**
   * If true, temporarily sets renderer.autoClear = true during capture.
   */
  autoClearDuringCapture?: boolean
}

type StablePmremCubeCameraProps = Omit<ThreeElements['group'], 'children'> &
  CubeCameraOptions & {
    /**
     * The subtree that should be excluded from the capture
     * (either by visibility hide or excludeLayer).
     */
    children?: React.ReactNode

    /**
     * Materials whose envMap should be swapped imperatively.
     * This avoids React rerenders.
     */
    materialRefs: Array<React.RefObject<SupportedEnvMaterial | null>>

    /**
     * If excludeLayer is undefined, the subtree will be hidden during capture.
     */
    useVisibilityHide?: boolean

    /**
     * Higher numbers run later in the frame.
     */
    renderPriority?: number

    /**
     * First frame on which capture is allowed.
     */
    firstFrame?: number

    /**
     * Update every N frames. 1 = every frame. 0 = never.
     */
    frameInterval?: number

    /**
     * Delay adoption of the freshly generated PMREM by this many frames.
     * Based on your observations, 1 is the key setting.
     */
    adoptDelayFrames?: number

    /**
     * If provided, this is applied to the materials immediately on mount,
     * before the first generated PMREM is ready.
     */
    initialEnvMap?: THREE.Texture | null

    disabled?: boolean
  }

function setLayerRecursive(obj: THREE.Object3D, layer: number) {
  obj.traverse((child) => {
    child.layers.disableAll()
    child.layers.enable(layer)
  })
}

function applyEnvMapToMaterials(
  materialRefs: Array<React.RefObject<SupportedEnvMaterial | null>>,
  texture: THREE.Texture | null
) {
  for (const materialRef of materialRefs) {
    const material = materialRef.current
    if (!material) continue

    const prev = material.envMap
    if (prev === texture) continue

    material.envMap = texture

    // Only force a material program refresh when crossing null/non-null.
    // Swapping one non-null envMap for another of the same kind is much cheaper.
    if ((prev == null) !== (texture == null)) {
      material.needsUpdate = true
    }
  }
}

export function StablePmremCubeCamera({
  children,
  materialRefs,
  resolution = 256,
  near = 0.1,
  far = 1000,
  envMap = null,
  fog = null,
  excludeLayer,
  disableShadowsDuringCapture = false,
  autoClearDuringCapture = false,
  useVisibilityHide = excludeLayer === undefined,
  renderPriority,
  firstFrame = 3,
  frameInterval = 1,
  adoptDelayFrames = 0,
  initialEnvMap = null,
  disabled,
  ...props
}: StablePmremCubeCameraProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const groupRef = useRef<THREE.Group>(null)
  const frameCountRef = useRef(0)

  if (disabled) {
    return <group ref={groupRef} {...props}>{children}</group>
  }

  // Raw cube capture target
  const cubeRT = useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(resolution)
    rt.texture.type = THREE.HalfFloatType
    return rt
  }, [resolution])

  // PMREM generator
  const pmremGenerator = useMemo(() => {
    const gen = new THREE.PMREMGenerator(gl)
    gen.compileCubemapShader()
    return gen
  }, [gl])

  // Cube camera
  const cubeCamera = useMemo(() => {
    const cam = new THREE.CubeCamera(near, far, cubeRT)
    if (excludeLayer !== undefined) {
      cam.layers.enableAll()
      cam.layers.disable(excludeLayer)
    }
    return cam
  }, [near, far, cubeRT, excludeLayer])

  // The PMREM currently displayed on the material
  const currentPmremRef = useRef<THREE.WebGLRenderTarget | null>(null)

  // Newly generated PMREM waiting to be adopted
  const pendingPmremRef = useRef<THREE.WebGLRenderTarget | null>(null)
  const pendingReadyFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      cubeRT.dispose()
      pmremGenerator.dispose()
      currentPmremRef.current?.dispose()
      pendingPmremRef.current?.dispose()
      currentPmremRef.current = null
      pendingPmremRef.current = null
    }
  }, [cubeRT, pmremGenerator])

  useEffect(() => {
    if (excludeLayer !== undefined && groupRef.current) {
      setLayerRecursive(groupRef.current, excludeLayer)
    }
  }, [excludeLayer])

  useEffect(() => {
    if (initialEnvMap !== undefined) {
      applyEnvMapToMaterials(materialRefs, initialEnvMap)
    }
  }, [materialRefs, initialEnvMap])

  const adoptPendingPmremIfReady = useCallback(() => {
    const pending = pendingPmremRef.current
    const readyFrame = pendingReadyFrameRef.current

    if (!pending || readyFrame == null) return
    if (frameCountRef.current < readyFrame) return

    const previousCurrent = currentPmremRef.current
    currentPmremRef.current = pending
    pendingPmremRef.current = null
    pendingReadyFrameRef.current = null

    applyEnvMapToMaterials(materialRefs, pending.texture)

    previousCurrent?.dispose()
  }, [materialRefs])

  const captureToPendingPmrem = useCallback(() => {
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

    cubeCamera.update(gl, scene)

    gl.autoClear = originalAutoClear
    gl.shadowMap.autoUpdate = originalShadowAutoUpdate
    scene.fog = originalFog
    scene.background = originalBackground

    // Generate PMREM from the freshly captured cubemap.
    const nextPmrem = pmremGenerator.fromCubemap(cubeRT.texture)

    // Do not adopt immediately. Keep it pending.
    // If there is an older unadopted pending target, replace/dispose it.
    pendingPmremRef.current?.dispose()
    pendingPmremRef.current = nextPmrem
    pendingReadyFrameRef.current = frameCountRef.current + adoptDelayFrames
  }, [
    gl,
    scene,
    cubeCamera,
    cubeRT,
    pmremGenerator,
    envMap,
    fog,
    disableShadowsDuringCapture,
    autoClearDuringCapture,
    adoptDelayFrames,
  ])

  useFrame(() => {
    if (!groupRef.current) return

    frameCountRef.current += 1
    const currentCount = frameCountRef.current

    // Step 1: adopt last frame's PMREM if it is now considered safe.
    adoptPendingPmremIfReady()

    // Step 2: decide whether to capture a new cubemap this frame.
    if (currentCount !== firstFrame && (frameInterval === 0 || currentCount % frameInterval !== 0)) {
      return
    }

    if (useVisibilityHide) {
      groupRef.current.visible = false
      captureToPendingPmrem()
      groupRef.current.visible = true
    } else {
      captureToPendingPmrem()
    }
    adoptPendingPmremIfReady()
  }, renderPriority)

  return (
    <group {...props}>
      <primitive object={cubeCamera} />
      <group ref={groupRef}>{children}</group>
    </group>
  )
}
