import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { WebGPURenderer } from 'three/webgpu'
import * as THREE from 'three/webgpu'
import { RenderPipeline } from 'three/webgpu'

import {
  convertToTexture,
  emissive,
  float,
  length,
  metalness,
  mrt,
  normalView,
  output,
  pass,
  renderOutput,
  roughness,
  screenUV,
  smoothstep,
  vec2,
  vec4,
} from 'three/tsl'

import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js'
import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js'
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js'
import { ssgi } from 'three/examples/jsm/tsl/display/SSGINode.js'
import { ssr } from 'three/examples/jsm/tsl/display/SSRNode.js'
import { useGameStore } from '../game/state/useGameStore'
import { asType } from '../game/utility/types'

type GpuTierLike = {
  tier: number
}

type WebGPUPostFXProps = {
  gpuTier: GpuTierLike
  allowingHigherTier1Quality?: boolean

  enableAO?: boolean
  enableSSGI?: boolean
  enableDenoise?: boolean
  enableBloom?: boolean
  enableContrast?: boolean
  enableVignette?: boolean
  enableDOF?: boolean
  enableSSR?: boolean

  aoExcludeLayer?: number
  particlesLayer?: number
  enableFxaa?: boolean
  enableSmaa?: boolean

  resolutionScale?: number
  ssrExcludeLayers?: number | number[]
  ssrIncludeLayers?: number | number[]
  renderPriority?: number
  cameraMask?: number
}

function toTextureNode(node: THREE.Node<'vec4'>): THREE.TextureNode {

  if ((node as THREE.TextureNode).isTextureNode) {
    return node as THREE.TextureNode
  }
  return convertToTexture(node)
}

export function WebGPUPostFX({
  gpuTier,
  allowingHigherTier1Quality = false,
  enableAO = true,
  enableSSGI = false,
  enableDenoise = false,
  enableBloom = true,
  enableContrast = true,
  enableVignette = true,
  enableDOF = true,
  enableSSR = true,
  aoExcludeLayer,
  particlesLayer,
  enableFxaa = false,
  enableSmaa = true,
  resolutionScale = 1,
  ssrExcludeLayers = [],
  ssrIncludeLayers = [],
  renderPriority = 1,
  cameraMask = 0,
}: WebGPUPostFXProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setScenePass = useGameStore((s) => s.setScenePass)

  const [pipeline, setPipeline] = useState<RenderPipeline | undefined>()

  const aoAllowed =
    enableAO &&
    (gpuTier.tier >= 2 || (false && allowingHigherTier1Quality && gpuTier.tier >= 1))

  const ssgiAllowed =
    enableSSGI &&
    gpuTier.tier >= 3

  const bloomAllowed =
    enableBloom &&
    (gpuTier.tier >= 2 || (true && allowingHigherTier1Quality && gpuTier.tier >= 1))

  const dofAllowed =
    enableDOF &&
    (gpuTier.tier >= 2 || (false && allowingHigherTier1Quality && gpuTier.tier >= 1))

  const ssrAllowed = asType<boolean>(true) && enableSSR && gpuTier.tier >= 1

  const ssrExcludeLayersArray = useMemo(() => (Array.isArray(ssrExcludeLayers) ? ssrExcludeLayers : [ssrExcludeLayers]), [ssrExcludeLayers])
  const ssrIncludeLayersArray = useMemo(() => (Array.isArray(ssrIncludeLayers) ? ssrIncludeLayers : [ssrIncludeLayers]), [ssrIncludeLayers])

  /**
   * Keep the AO exclusion layer in sync with userData.cannotReceiveAO.
   * We only touch the dedicated aoExcludeLayer bit, and preserve all other layers.
   */
  useEffect(() => {
    if ((aoAllowed || ssgiAllowed) && aoExcludeLayer !== undefined) {
      scene.traverse((obj) => {
        if ((obj as THREE.Object3D).userData?.cannotReceiveAO) {
          obj.layers.disableAll()
          obj.layers.enable(aoExcludeLayer)
          if (asType<boolean>(false)) {
            console.log('AO exclusion layer enabled for object', obj)
          }
        }
      })
    }
  }, [
    aoAllowed,
    ssgiAllowed,
    scene,
    aoExcludeLayer,
  ])

  useLayoutEffect(() => {
    if (!gl || !scene || !camera || !gl.isWebGPURenderer) {
      setScenePass(undefined)
      setPipeline(undefined)
      return
    }

    // Main scene pass
    const scenePass = pass(scene, camera, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        samples: 0,
    })

    scenePass.setResolutionScale(resolutionScale)
    const mainLayers = new THREE.Layers()
    mainLayers.mask = cameraMask
    if (particlesLayer !== undefined) {
      mainLayers.disable(particlesLayer)
    }
    scenePass.setLayers(mainLayers)

    const renderPipeline = new RenderPipeline(gl)

    // AO scene pass: same scene, but excluding objects on the aoExcludeLayer
    const aoScenePass = aoAllowed ? pass(scene, camera) : undefined
    if (aoScenePass) {
      aoScenePass.setResolutionScale(resolutionScale)
      const aoLayers = new THREE.Layers()
      aoLayers.mask = mainLayers.mask
      if (aoExcludeLayer !== undefined) {
        aoLayers.disable(aoExcludeLayer)
      }
      aoScenePass.setLayers(aoLayers)
    }

    const ssrScenePass = ssrAllowed && (ssrExcludeLayersArray.length > 0 || ssrIncludeLayersArray.length > 0) ? pass(scene, camera) : undefined

    if (ssrScenePass) {
      ssrScenePass.setResolutionScale(resolutionScale)
      const ssrLayers = new THREE.Layers()
      ssrLayers.mask = mainLayers.mask
      ssrExcludeLayersArray.forEach(layer => ssrLayers.disable(layer))
      ssrIncludeLayersArray.forEach(layer => ssrLayers.enable(layer))
      ssrScenePass.setLayers(ssrLayers)
    }

    const particlesPass = particlesLayer !== undefined ? pass(scene, camera, {
      colorSpace: THREE.LinearSRGBColorSpace,
    }) : undefined
    if (particlesPass && particlesLayer !== undefined) {
      const particlesLayers = new THREE.Layers()
      particlesLayers.mask = 0
      particlesLayers.enable(particlesLayer)
      particlesPass.setLayers(particlesLayers)
    }

    const testingNormal = asType<boolean>(false)
    const testingAoNormal = asType<boolean>(false)

    const needsNormal = testingNormal || ((aoAllowed || ssgiAllowed) && !aoScenePass) || (ssrAllowed && !ssrScenePass) || dofAllowed
    const aoNeedsNormal = testingAoNormal || ((aoAllowed || ssgiAllowed) && !!aoScenePass)
    const ssrNeedsNormal = asType<boolean>(true) && ssrAllowed && !!ssrScenePass
    const needsEmissive = asType<boolean>(false) && bloomAllowed
    const needsMetalness = asType<boolean>(true) && ssrAllowed && !ssrScenePass
    const ssrNeedsMetalness = asType<boolean>(true) && ssrAllowed && !!ssrScenePass
    const needsRoughness = asType<boolean>(true) && ssrAllowed && !ssrScenePass
    const ssrNeedsRoughness = asType<boolean>(true) && ssrAllowed && !!ssrScenePass


    if (needsNormal || needsEmissive || needsMetalness || needsRoughness) {
      scenePass.setMRT(
        mrt({
          output,
          ...needsNormal ? {
            normal: normalView,
          } : {},
          ...needsEmissive ? {
            emissive,
          } : {},
          ...needsMetalness ? {
            metalness,
          } : {},
          ...needsRoughness ? {
            roughness,
          } : {},
        }),
      )
    }

    if (aoScenePass && aoNeedsNormal) {
      aoScenePass.setMRT(
        mrt({
          output,
          ...aoNeedsNormal ? {
            normal: normalView,
          } : {},
        }),
      )
    }

    if (ssrScenePass && (ssrNeedsNormal || ssrNeedsMetalness || ssrNeedsRoughness)) {
      ssrScenePass.setMRT(
        mrt({
          output,
          ...ssrNeedsNormal ? {
            normal: normalView,
          } : {},
          ...ssrNeedsMetalness ? {
            metalness,
          } : {},
          ...ssrNeedsRoughness ? {
            roughness,
          } : {},
        }),
      )
    }

    let colorNode: THREE.Node<'vec4'> = scenePass.getTextureNode('output')

    if (asType<boolean>(false) && particlesPass) {
      colorNode = vec4(
        particlesPass.getTextureNode('output').rgb,
        colorNode.a
      )
    } else if (testingNormal) {
      const scenePassNormal = scenePass.getTextureNode('normal')
      colorNode = scenePassNormal
    } else if (testingAoNormal) {
      const aoPassNormal = aoScenePass!.getTextureNode('normal')
      colorNode = aoPassNormal
    } else {
      if (aoAllowed || ssgiAllowed) {
        const pass = aoScenePass ?? scenePass
        const scenePassDepth = pass.getTextureNode('depth')
        const scenePassNormal = pass.getTextureNode('normal')

        if (ssgiAllowed) {
          const scenePassColor = pass.getTextureNode('output')
          const ssgiPass = ssgi(
            scenePassColor,
            scenePassDepth,
            scenePassNormal,
            pass.camera as THREE.PerspectiveCamera,
          )
          ssgiPass.useTemporalFiltering = false

          // conservative starter settings
          ssgiPass.giIntensity.value = 4
          ssgiPass.aoIntensity.value = 1
          ssgiPass.radius.value = 8
          ssgiPass.thickness.value = 1
          ssgiPass.sliceCount.value = 2
          ssgiPass.stepCount.value = 8
          ssgiPass.expFactor.value = 2
          ssgiPass.useScreenSpaceSampling.value = false
          ssgiPass.useLinearThickness.value = false
          ssgiPass.backfaceLighting.value = 0

          colorNode = vec4(
            colorNode.rgb.add(ssgiPass.rgb),
            colorNode.a
          )
        } else {
          const aoPass = ao(scenePassDepth, scenePassNormal, pass.camera)

          // Tune roughly analogous to your N8AO settings
          aoPass.radius.value = 0.6
          aoPass.distanceFallOff.value = 0.6
          aoPass.samples.value = gpuTier.tier >= 3 ? 24 : gpuTier.tier >= 2 ? 16 : 8
          aoPass.resolutionScale = gpuTier.tier >= 3 ? 1.0 : 0.5

          // These two are optional but usually worth setting
          aoPass.scale.value = 1.0
          aoPass.thickness.value = 1.0

          colorNode = vec4(
            colorNode.rgb.mul(aoPass.r),
            colorNode.a,
          )
        }

        if (enableDenoise) {
          // Apply denoising pass here
          const denoisePass = denoise(
            toTextureNode(colorNode),
            scenePassDepth,
            scenePassNormal,
            pass.camera,
          )
          denoisePass.radius.value = 2

          colorNode = denoisePass.toVec4()
        }
      }

      if (asType<boolean>(true) && particlesPass) {
        colorNode = vec4(
          colorNode.rgb.add(particlesPass.getTextureNode('output').rgb),
          colorNode.a
        )
      }

      if (ssrAllowed) {
        const pass = ssrScenePass ?? scenePass
        const scenePassDepth = pass.getTextureNode('depth')
        const scenePassNormal = pass.getTextureNode('normal')
        const scenePassMetalness = pass.getTextureNode('metalness')
        const scenePassRoughness = pass.getTextureNode('roughness')

        // Create SSR pass
        const ssrPass = ssr(
          toTextureNode(colorNode),
          scenePassDepth,
          scenePassNormal,
          scenePassMetalness,
          scenePassRoughness,
          camera,
        );
        ssrPass.opacity.value = 0.65
        ssrPass.maxDistance.value = 15
        ssrPass.thickness.value = 0.018
        ssrPass.quality.value = gpuTier.tier >= 3 ? 0.7 : gpuTier.tier >= 2 ? 0.5 : 0.35
        ssrPass.blurQuality.value = gpuTier.tier >= 3 ? 2 : 1
        ssrPass.resolutionScale = gpuTier.tier >= 3 ? 1.0 : 0.5

        colorNode = vec4(
          colorNode.rgb.add(ssrPass.rgb),
          colorNode.a
        )
      }

      // Bloom
      if (bloomAllowed) {
        const bloomPass = bloom(toTextureNode(colorNode), 0.22, 0.0, 1.05)
        bloomPass.smoothWidth.value = 0.03
        colorNode = colorNode.add(bloomPass)
      }

      // DOF
      if (dofAllowed) {
        const scenePassViewZDepth = scenePass.getViewZNode('depth')

        const dofPass = dof(
          toTextureNode(colorNode),
          scenePassViewZDepth,
          0.02 * 100, // focusDistance in world units along camera look dir
          0.01 * 25, // focalLength / focus falloff width
          0.4,  // bokehScale
        )

        colorNode = dofPass.toVec4()
      }

      if (enableFxaa) {
        colorNode = fxaa(toTextureNode(colorNode)).toVec4()
      }

      if (enableSmaa) {
        colorNode = smaa(toTextureNode(colorNode)).toVec4()
      }

      // ACES Filmic tone mapping
      if (asType<boolean>(true)) {
        colorNode = renderOutput(
          colorNode,
          THREE.ACESFilmicToneMapping,
          THREE.SRGBColorSpace,
        )

        colorNode = vec4(
          colorNode.rgb.mul(0.9),
          colorNode.a,
        )
      }

      // Contrast
      if (enableContrast && gpuTier.tier >= 1) {
        const brightness = 0.0
        const contrast = 0.09
        const contrastedRgb = colorNode.rgb
          .add(brightness)
          .sub(0.5)
          .mul(1.0 + contrast)
          .add(0.5)

        colorNode = vec4(contrastedRgb, colorNode.a)
      }

      // Vignette
      if (enableVignette && gpuTier.tier >= 1) {
        const offset = 0.18
        const darkness = 0.28

        const centered = screenUV.sub(vec2(0.5)).mul(2.0)
        const dist = length(centered)

        // 0 in center, 1 toward corners
        const vig = smoothstep(offset, 1.0, dist)

        const vignettedRgb = colorNode.rgb.mul(float(1.0).sub(vig.mul(darkness)))
        colorNode = vec4(vignettedRgb, colorNode.a)
      }
    }

    // Keep default output transform enabled on RenderPipeline.
    // That means renderer toneMapping / exposure / outputColorSpace
    // are applied at the end automatically.
    renderPipeline.outputNode = colorNode
    renderPipeline.outputColorTransform = false

    setPipeline(renderPipeline)
    setScenePass(scenePass)

    return () => {
      pipeline?.dispose()
    }
  }, [
    gl,
    scene,
    camera,
    cameraMask,
    gpuTier.tier,
    aoAllowed,
    bloomAllowed,
    dofAllowed,
    enableContrast,
    enableVignette,
    ssrExcludeLayersArray,
    ssrIncludeLayersArray,
  ])

  // Take over rendering (renderPriority > 0) so R3F doesn't also do its normal gl.render(scene, camera).
  useFrame(({ gl }) => {
    if (!gl || !pipeline) {
      return
    }

    gl.clear()
    pipeline.render()
  }, renderPriority)

  return null
}
