import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import * as React from 'react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react'
import { pmremTexture, reflectVector, rotate, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { asType } from '../utility/types'

type CubeCameraOptions = {
  resolution?: number
  near?: number
  far?: number
  envMap?: THREE.Texture | null
  fog?: THREE.Fog | THREE.FogExp2 | null

  cameraMask?: number

  /**
   * If provided, the cube camera will not render these layer.
   * Put the reflective object on one of these layers instead of hiding it.
   */
  excludeLayers?: number | number[]

  includeLayers?: number | number[]

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
     * (either by visibility hide or excludeLayers).
     */
    children?: (props: { envNode?: THREE.Node | null }) => React.ReactNode

    envRotation?: [number, number, number] | undefined

    /**
     * If excludeLayers is undefined or empty, the subtree will be hidden during capture.
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
     * If provided, this is applied to the materials immediately on mount,
     * before the first generated cubemap is ready.
     */
    initialEnvMap?: THREE.Texture | null

    disabled?: boolean
  }

type RendererLike = {
  autoClear: boolean
  shadowMap?: {
    autoUpdate: boolean
  }
}

export function StablePmremCubeCamera({
  children,
  envRotation = [0, 0, 0],
  resolution = 256,
  near = 0.09,
  far = 100,
  envMap = null,
  fog = null,
  excludeLayers = [],
  includeLayers = [],
  disableShadowsDuringCapture = false,
  autoClearDuringCapture = true,
  useVisibilityHide,
  renderPriority,
  firstFrame = 3,
  frameInterval = 1,
  initialEnvMap = null,
  disabled,
  cameraMask = 0,
  ...props
}: StablePmremCubeCameraProps) {
  const gl = useThree((s) => s.gl) as unknown as THREE.Renderer & RendererLike
  const scene = useThree((s) => s.scene)
  const groupRef = useRef<THREE.Group>(null)
  const frameCountRef = useRef(0)

  const [rtA, setRtA] = useState<THREE.CubeRenderTarget | null>(null)
  const [rtB, setRtB] = useState<THREE.CubeRenderTarget | null>(null)
  const [cubeCameraA, setCubeCameraA] = useState<THREE.CubeCamera | null>(null)
  const [cubeCameraB, setCubeCameraB] = useState<THREE.CubeCamera | null>(null)
  const [envNode, setEnvNode] = useState<THREE.PMREMNode | null>(null)

  const rtsToDisposeRef = useRef<THREE.CubeRenderTarget[]>([])
  const nodesToDisposeRef = useRef<THREE.Node[]>([])

  const [envRotationUniformNode, setEnvRotationUniformNode] = useState<THREE.UniformNode<'vec3', THREE.Vector3> | null>(null)

  useEffect(() => {
    if (disabled) {
      return
    }

    const envRotationUniformNode = uniform(new THREE.Vector3())
    setEnvRotationUniformNode(envRotationUniformNode)
  }, [disabled])

  useEffect(() => {
    if (envRotationUniformNode) {
      return () => {
        nodesToDisposeRef.current.push(envRotationUniformNode)
      }
    }
  }, [envRotationUniformNode])

  useEffect(() => {
    if (disabled) {
      return
    }

    const createTarget = () => {
      const rt = new THREE.CubeRenderTarget(resolution, {
        type: THREE.HalfFloatType,
      })

      return rt
    }
    const rtA = createTarget()
    const rtB = createTarget()
    setRtA(rtA)
    setRtB(rtB)

    return () => {
      rtsToDisposeRef.current.push(rtA, rtB)
    }
  }, [
    disabled,
    resolution,
  ])

  const excludeLayersArray = useMemo(() => (Array.isArray(excludeLayers) ? excludeLayers : [excludeLayers]), [excludeLayers])
  const includeLayersArray = useMemo(() => (Array.isArray(includeLayers) ? includeLayers : [includeLayers]), [includeLayers])

  const useVisibilityHideResolved = useMemo(() => useVisibilityHide ?? excludeLayersArray.length > 0, [useVisibilityHide, excludeLayersArray])

  useEffect(() => {
    if (disabled) {
      return
    }

    const createCamera = (rt: THREE.CubeRenderTarget) => {
      return new THREE.CubeCamera(near, far, rt)
    }

    const cameraA = rtA ? createCamera(rtA) : null
    const cameraB = rtB ? createCamera(rtB) : null

    if (cameraA) {
      setCubeCameraA(cameraA)
    }
    if (cameraB) {
      setCubeCameraB(cameraB)
    }
  }, [
    disabled,
    rtA,
    rtB,
    near,
    far,
  ])

  useLayoutEffect(() => {
    if (disabled) {
      return
    }

    const cams = [cubeCameraA, cubeCameraB]
    cams.filter(c => !!c).forEach((cam) => {
      const { layers } = cam
      layers.mask = cameraMask
      includeLayersArray.forEach((layer) => {
        layers.enable(layer)
      })
      excludeLayersArray.forEach((layer) => {
        layers.disable(layer)
      })
    })
  }, [
    disabled,
    cubeCameraA,
    cubeCameraB,
    cameraMask,
    includeLayersArray,
    excludeLayersArray,
  ])

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!rtA || !envRotationUniformNode) {
      setEnvNode(null)
      return
    }

    const rotationNode = rotate(reflectVector, envRotationUniformNode)
    const envNode = pmremTexture(rtA.texture, rotationNode)
    setEnvNode(envNode)

    return () => {
      nodesToDisposeRef.current.push(rotationNode, envNode)
    }
  }, [
    disabled,
    rtA,
    envRotationUniformNode,
  ])

  useLayoutEffect(() => {
    if (disabled) {
      return
    }

    if (envRotationUniformNode) {
      envRotationUniformNode.value.set(...envRotation)
    }
  }, [disabled, envRotationUniformNode, envRotation])

  const disposeUnused = useCallback(() => {
    while (nodesToDisposeRef.current.length > 0) {
      const node = nodesToDisposeRef.current.pop()
      if (node) {
        if (asType<boolean>(false)) {
          console.debug('Disposing node', node)
        }
        node.dispose()
      }
    }
    while (rtsToDisposeRef.current.length > 0) {
      const rt = rtsToDisposeRef.current.pop()
      if (rt) {
        if (asType<boolean>(false)) {
          console.debug('Disposing render target', rt)
        }
        rt.dispose()
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      disposeUnused()
    }
  }, [envNode, disposeUnused])

  const captureToPendingEnvMap = useCallback((cubeCamera: THREE.CubeCamera, rt: THREE.CubeRenderTarget) => {
    if (disabled) {
      return
    }

    const originalFog = scene.fog
    const originalBackground = scene.background
    const originalShadowAutoUpdate = gl.shadowMap.autoUpdate
    const originalAutoClear = gl.autoClear
    const originalAutoClearDepth = gl.autoClearDepth
    const originalAutoClearStencil = gl.autoClearStencil

    scene.background = envMap ?? originalBackground
    scene.fog = fog ?? originalFog

    if (disableShadowsDuringCapture && gl.shadowMap.enabled) {
      gl.shadowMap.autoUpdate = false
    }

    if (autoClearDuringCapture) {
      gl.autoClear = true
      gl.autoClearDepth = true
      gl.autoClearStencil = true
    }

    cubeCamera.update(gl, scene)

    gl.autoClear = originalAutoClear
    gl.autoClearDepth = originalAutoClearDepth
    gl.autoClearStencil = originalAutoClearStencil
    gl.shadowMap.autoUpdate = originalShadowAutoUpdate

    scene.fog = originalFog
    scene.background = originalBackground

    // TODO: remove as this does not appear to be necessary after all - texture renders fine without it
    // Important for dynamic env maps:
    // tell three.js the captured texture changed and its PMREM must be refreshed.
    if (asType<boolean>(false)) {
      rt.texture.needsPMREMUpdate = true
    }
  }, [
    disabled,
    gl,
    scene,
    envMap,
    fog,
    disableShadowsDuringCapture,
    autoClearDuringCapture,
  ])

  useFrame(() => {
    if (!groupRef.current) {
      return
    }

    frameCountRef.current += 1
    const currentCount = frameCountRef.current

    // Step 2: decide whether to capture this frame.
    const shouldCapture =
      currentCount === firstFrame ||
      (frameInterval > 0 && currentCount > firstFrame && currentCount % frameInterval === 0)

    if (!shouldCapture) {
      return
    }

    if (disabled) {
      return
    }

    let cubeCamera = cubeCameraA
    let rtWrite = rtA

    if (asType<boolean>(false)) {
      // double buffering
      rtWrite = currentCount % 2 ? rtA : rtB
      const rtRead = currentCount % 2 ? rtB : rtA
      cubeCamera = currentCount % 2 ? cubeCameraA : cubeCameraB
      if (envNode && rtRead) {
        envNode.value = rtRead.texture
      }
    }

    if (cubeCamera && rtWrite) {
      if (useVisibilityHideResolved) {
        groupRef.current.visible = false
        captureToPendingEnvMap(cubeCamera, rtWrite)
        groupRef.current.visible = true
      } else {
        captureToPendingEnvMap(cubeCamera, rtWrite)
      }
    }
  }, renderPriority)

  return (
    <group {...props}>
      {cubeCameraA && (
        <primitive object={cubeCameraA} />
      )}
      {cubeCameraB && (
        <primitive object={cubeCameraB} />
      )}
      <group ref={groupRef}>
        {children?.({ envNode: disabled ? undefined : envNode })}
      </group>
    </group>
  )
}
