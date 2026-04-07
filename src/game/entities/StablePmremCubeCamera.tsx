import { useFrame, useThree, type ThreeElements } from '@react-three/fiber'
import * as React from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { pmremTexture, reflectVector, rotate, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'
import type { Renderer } from '../../render/render'
import { normalizeLayerList } from '../utility/layers'
import { asType } from '../utility/types'

type CubeCameraOptions = {
  resolution?: number
  near?: number
  far?: number
  envMap?: THREE.Texture
  fog?: THREE.Fog | THREE.FogExp2

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
    children?: (props: { envNode?: THREE.Node }) => React.ReactNode

    envRotation?: [number, number, number] | undefined

    /**
     * If excludeLayers is undefined or empty, the subtree will be hidden during capture.
     */
    useVisibilityHide?: boolean

    /**
      * Higher numbers run later in the frame.
      * Callers should coordinate this with any render-owning post-processing pass
      * so cube capture runs after the visible frame render, not before it.
      * Capturing too early in the same frame can invalidate AO/depth/normal-based
      * post passes for the main camera.
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

    disabled?: boolean
  }

export function StablePmremCubeCamera({
  children,
  envRotation = [0, 0, 0],
  resolution = 256,
  near = 0.09,
  far = 100,
  envMap,
  fog,
  excludeLayers = [],
  includeLayers = [],
  disableShadowsDuringCapture = false,
  autoClearDuringCapture = true,
  useVisibilityHide,
  renderPriority,
  firstFrame = 3,
  frameInterval = 1,
  disabled,
  cameraMask = 0,
  ...props
}: StablePmremCubeCameraProps) {
  const gl = useThree((s) => s.gl) as unknown as Renderer
  const scene = useThree((s) => s.scene)
  const groupRef = useRef<THREE.Group>(undefined)
  const frameCountRef = useRef(0)
  const glRef = useRef(gl)
  const sceneRef = useRef(scene)
  const envNodeARef = useRef<THREE.PMREMNode | undefined>(undefined)
  const envNodeBRef = useRef<THREE.PMREMNode | undefined>(undefined)

  const [rtA, setRtA] = useState<THREE.CubeRenderTarget | undefined>(undefined)
  const [rtB, setRtB] = useState<THREE.CubeRenderTarget | undefined>(undefined)
  const [cubeCameraA, setCubeCameraA] = useState<THREE.CubeCamera | undefined>(undefined)
  const [cubeCameraB, setCubeCameraB] = useState<THREE.CubeCamera | undefined>(undefined)
  const [activeEnvNode, setActiveEnvNode] = useState<THREE.PMREMNode | undefined>(undefined)
  const [hasAdoptedEnvMap, setHasAdoptedEnvMap] = useState(false)

  const rtsToDisposeRef = useRef<THREE.RenderTarget[]>([])
  const nodesToDisposeRef = useRef<THREE.Node[]>([])
  const rotationNodeRef = useRef<THREE.Node | undefined>(undefined)
  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | undefined>(undefined)
  const currentRtRef = useRef<THREE.CubeRenderTarget | undefined>(undefined)
  const pmremRtARef = useRef<THREE.RenderTarget | undefined>(undefined)
  const pmremRtBRef = useRef<THREE.RenderTarget | undefined>(undefined)

  const [envRotationUniformNode, setEnvRotationUniformNode] = useState<THREE.UniformNode<'vec3', THREE.Vector3> | null>(null)

  const excludeLayersKey = normalizeLayerList(excludeLayers).join(',')
  const includeLayersKey = normalizeLayerList(includeLayers).join(',')

  const excludeLayersArray = useMemo(
    () => excludeLayersKey ? excludeLayersKey.split(',').map(s => Number(s)) : [],
    [excludeLayersKey],
  )

  const includeLayersArray = useMemo(
    () => includeLayersKey ? includeLayersKey.split(',').map(s => Number(s)) : [],
    [includeLayersKey],
  )

  const useVisibilityHideResolved = useMemo(
    () => useVisibilityHide ?? excludeLayersArray.length === 0,
    [
      useVisibilityHide,
      excludeLayersArray,
    ],
  )

  useEffect(() => {
    glRef.current = gl
  }, [gl])

  useEffect(() => {
    sceneRef.current = scene
  }, [scene])

  useEffect(() => {
    if (disabled) {
      return
    }

    console.debug('Creating PMREM generator')

    const pmremGenerator = new THREE.PMREMGenerator(gl)
    pmremGeneratorRef.current = pmremGenerator

    return () => {
      if (pmremGeneratorRef.current === pmremGenerator) {
        pmremGeneratorRef.current = undefined
      }
      pmremGenerator.dispose()
    }
  }, [disabled, gl])

  useEffect(() => {
    if (disabled) {
      return
    }

    console.debug('Creating env rotation uniform node')

    const envRotationUniformNode = uniform(new THREE.Vector3())
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnvRotationUniformNode(envRotationUniformNode)

    return () => {
      console.debug('Marking env rotation uniform node for disposal')
      setEnvRotationUniformNode(current => current === envRotationUniformNode ? null : current)
      nodesToDisposeRef.current.push(envRotationUniformNode)
    }
  }, [disabled])

  useEffect(() => {
    if (disabled || !envRotationUniformNode) {
      rotationNodeRef.current = undefined
      return
    }

    const rotationNode = rotate(reflectVector, envRotationUniformNode)
    rotationNodeRef.current = rotationNode

    return () => {
      if (rotationNodeRef.current === rotationNode) {
        rotationNodeRef.current = undefined
      }
      nodesToDisposeRef.current.push(rotationNode)
    }
  }, [disabled, envRotationUniformNode])

  useLayoutEffect(() => {
    if (disabled) {
      return
    }

    if (envRotationUniformNode) {
      console.debug('Updating env rotation uniform node with', envRotation)
      envRotationUniformNode.value.set(...envRotation)
    }
  }, [
    disabled,
    envRotationUniformNode,
    envRotation,
  ])

  useEffect(() => {
    if (disabled) {
      return
    }

    console.debug('Initializing render targets with resolution', resolution)

    const createTarget = () => {
      const rt = new THREE.CubeRenderTarget(resolution, {
        type: THREE.HalfFloatType,
      })

      return rt
    }

    const rtA = createTarget()
    const rtB = createTarget()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRtA(rtA)
    setRtB(rtB)

    return () => {
      console.debug('Marking cube camera render targets for disposal')
      setRtA(current => current === rtA ? undefined : current)
      setRtB(current => current === rtB ? undefined : current)
      rtsToDisposeRef.current.push(rtA, rtB)
      currentRtRef.current = undefined
      if (pmremRtARef.current) {
        rtsToDisposeRef.current.push(pmremRtARef.current)
      }
      if (pmremRtBRef.current) {
        rtsToDisposeRef.current.push(pmremRtBRef.current)
      }
      pmremRtARef.current = undefined
      pmremRtBRef.current = undefined
      if (envNodeARef.current) {
        nodesToDisposeRef.current.push(envNodeARef.current)
      }
      if (envNodeBRef.current) {
        nodesToDisposeRef.current.push(envNodeBRef.current)
      }
      envNodeARef.current = undefined
      envNodeBRef.current = undefined
      setActiveEnvNode(undefined)
      setHasAdoptedEnvMap(false)
    }
  }, [
    disabled,
    resolution,
  ])

  useEffect(() => {
    console.debug('useVisibilityHideResolved:', useVisibilityHideResolved)
  }, [useVisibilityHideResolved])

  useEffect(() => {
    if (disabled) {
      return
    }

    console.debug('Creating cube cameras')

    const createCamera = (rt: THREE.CubeRenderTarget) => {
      return new THREE.CubeCamera(near, far, rt)
    }

    const cameraA = rtA ? createCamera(rtA) : undefined
    const cameraB = rtB ? createCamera(rtB) : undefined

    if (cameraA) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCubeCameraA(cameraA)
    }
    if (cameraB) {
      setCubeCameraB(cameraB)
    }

    return () => {
      console.debug('Clearing cube cameras')
      setCubeCameraA(current => current === cameraA ? undefined : current)
      setCubeCameraB(current => current === cameraB ? undefined : current)
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

      console.debug('Configured cube camera layers with mask', cameraMask, 'include', includeLayersArray, 'exclude', excludeLayersArray)
      const layersDebug = new THREE.Layers()
      layersDebug.mask = layers.mask
      for (let i = 0; i < 32; i++) {
        if (layersDebug.isEnabled(i)) {
          console.debug('Cube camera layer enabled:', i)
        }
      }
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
    if (nodesToDisposeRef.current.length === 0 && rtsToDisposeRef.current.length === 0) {
      return
    }

    const nodesToDispose = [...nodesToDisposeRef.current]
    const rtsToDispose = [...rtsToDisposeRef.current]

    const disposeUnused = () => {
      console.debug('Disposing unused nodes and render targets. Pending disposals:', {
        nodes: nodesToDisposeRef.current.length,
        renderTargets: rtsToDisposeRef.current.length,
      })

      nodesToDispose.reverse()
      nodesToDispose.forEach(node => {
        if (nodesToDisposeRef.current.includes(node)) {
          if (asType<boolean>(true)) {
            console.debug('Disposing node', node)
          }
          node.dispose()
          nodesToDisposeRef.current = nodesToDisposeRef.current.filter(n => n !== node)
        }
      })

      rtsToDispose.forEach(rt => {
        if (rtsToDisposeRef.current.includes(rt)) {
          if (asType<boolean>(true)) {
            console.debug('Disposing render target', rt)
          }
          rt.dispose()
          rtsToDisposeRef.current = rtsToDisposeRef.current.filter(r => r !== rt)
        }
      })
    }

    let cancelled = false

    const frame = requestAnimationFrame(() => {
      if (cancelled) {
        return
      }

      disposeUnused()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [activeEnvNode])

  const getOrCreateEnvNodeForRenderTarget = useCallback((
    renderTarget: THREE.CubeRenderTarget,
    pmremRt: THREE.RenderTarget,
  ) => {
    const rotationNode = rotationNodeRef.current

    if (!rotationNode) {
      return undefined
    }

    const envNodeRef = renderTarget === rtA ? envNodeARef : envNodeBRef
    const currentEnvNode = envNodeRef.current

    if (currentEnvNode) {
      currentEnvNode.value = pmremRt.texture
      return currentEnvNode
    }

    console.debug('Creating envNode for render target slot')

    const envNode = pmremTexture(pmremRt.texture, rotationNode)
    envNodeRef.current = envNode

    return envNode
  }, [rtA])

  const captureToPendingEnvMap = useCallback((cubeCamera: THREE.CubeCamera, renderTarget: THREE.CubeRenderTarget) => {
    if (disabled) {
      return
    }

    const renderer = glRef.current
    const currentScene = sceneRef.current
    const pmremGenerator = pmremGeneratorRef.current

    if (!pmremGenerator) {
      return
    }

    const originalFog = currentScene.fog
    const originalBackground = currentScene.background
    const originalShadowEnabled = renderer.shadowMap.enabled
    const originalShadowAutoUpdate = renderer.shadowMap.autoUpdate
    const originalAutoClear = renderer.autoClear
    const originalAutoClearDepth = renderer.autoClearDepth
    const originalAutoClearStencil = renderer.autoClearStencil

    currentScene.background = envMap ?? originalBackground
    currentScene.fog = fog ?? originalFog

    if (disableShadowsDuringCapture && originalShadowEnabled) {
      renderer.shadowMap.enabled = false
      renderer.shadowMap.autoUpdate = false
    }

    if (autoClearDuringCapture) {
      renderer.autoClear = true
      renderer.autoClearDepth = true
      renderer.autoClearStencil = true
    }

    cubeCamera.update(renderer, currentScene)

    renderer.autoClear = originalAutoClear
    renderer.autoClearDepth = originalAutoClearDepth
    renderer.autoClearStencil = originalAutoClearStencil
    renderer.shadowMap.enabled = originalShadowEnabled
    renderer.shadowMap.autoUpdate = originalShadowAutoUpdate

    currentScene.fog = originalFog
    currentScene.background = originalBackground

    const currentPmremRt = renderTarget === rtA ? pmremRtARef.current : pmremRtBRef.current
    const nextPmremRt = pmremGenerator.fromCubemap(renderTarget.texture, currentPmremRt)

    if (renderTarget === rtA) {
      pmremRtARef.current = nextPmremRt
    } else {
      pmremRtBRef.current = nextPmremRt
    }

    const nextEnvNode = getOrCreateEnvNodeForRenderTarget(renderTarget, nextPmremRt)

    if (nextEnvNode) {
      currentRtRef.current = renderTarget
      setActiveEnvNode(nextEnvNode)
      setHasAdoptedEnvMap(current => current || true)
    }

    if (asType<boolean>(false)) {
      console.debug('Captured cube map and generated PMREM for env map')
    }
  }, [
    disabled,
    envMap,
    fog,
    disableShadowsDuringCapture,
    autoClearDuringCapture,
    getOrCreateEnvNodeForRenderTarget,
    rtA,
  ])

  const runCapture = useCallback((cubeCamera: THREE.CubeCamera, renderTarget: THREE.CubeRenderTarget) => {
    if (!groupRef.current || disabled) {
      return
    }

    if (useVisibilityHideResolved) {
      groupRef.current.visible = false
      captureToPendingEnvMap(cubeCamera, renderTarget)
      groupRef.current.visible = true
    } else {
      captureToPendingEnvMap(cubeCamera, renderTarget)
    }
  }, [disabled, useVisibilityHideResolved, captureToPendingEnvMap])

  useFrame(() => {
    if (!groupRef.current) {
      return
    }

    if (disabled) {
      return
    }

    const currentCount = frameCountRef.current + 1
    frameCountRef.current = currentCount

    // Step 2: decide whether to capture this frame.
    const shouldCapture =
      currentCount === firstFrame ||
      (frameInterval > 0 && currentCount > firstFrame && currentCount % frameInterval === 0)

    if (!shouldCapture) {
      return
    }

    const activeOrPendingRt = currentRtRef.current
    const captureRt = activeOrPendingRt === rtA ? rtB : rtA
    const cubeCamera = captureRt === rtB ? cubeCameraB : cubeCameraA

    if (cubeCamera && captureRt) {
      runCapture(cubeCamera, captureRt)
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
        {children?.({ envNode: disabled || !hasAdoptedEnvMap ? undefined : activeEnvNode })}
      </group>
    </group>
  )
}
