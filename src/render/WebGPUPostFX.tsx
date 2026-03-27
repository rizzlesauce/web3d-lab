import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'
import { RenderPipeline } from 'three/webgpu'

import {
  pass,
  mrt,
  output,
  emissive,
  metalness,
  normalView,
  float,
  vec2,
  vec4,
  screenUV,
  length,
  smoothstep,
  renderOutput,
  roughness,
  convertToTexture,
} from 'three/tsl'

import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { asType } from '../game/utility/types'
import { ssr } from 'three/examples/jsm/tsl/display/SSRNode.js'
import { fxaa } from 'three/examples/jsm/tsl/display/FXAANode.js'
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js'
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js'
import { ssgi } from 'three/examples/jsm/tsl/display/SSGINode.js'

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
  aoExcludeLayer = 10,
  particlesLayer = 11,
  enableFxaa = false,
  enableSmaa = false,
  resolutionScale = 1,
}: WebGPUPostFXProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

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

  /**
   * Keep the AO exclusion layer in sync with userData.cannotReceiveAO.
   * We only touch the dedicated aoExcludeLayer bit, and preserve all other layers.
   */
  useEffect(() => {
    if (aoAllowed || ssgiAllowed) {
      scene.traverse((obj) => {
        if ((obj as THREE.Object3D).userData?.cannotReceiveAO) {
          obj.layers.enable(aoExcludeLayer)
          if (asType<boolean>(false)) {
            console.log('AO exclusion layer enabled for object', obj)
          }
        } else {
          obj.layers.disable(aoExcludeLayer)
        }
      })
    }
  }, [scene, aoAllowed, ssgiAllowed])

  const pipeline = useMemo(() => {
    if (!gl || !scene || !camera) return null

    if (!gl?.isWebGPURenderer) return null

    const renderPipeline = new RenderPipeline(gl)

    const cameraLayers = new THREE.Layers()
    cameraLayers.mask = camera.layers.mask

    // Main scene pass
    const scenePass = pass(scene, camera, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        samples: 0,
    })
    scenePass.setResolutionScale(resolutionScale)
    if (particlesLayer !== undefined) {
      const mainLayers = new THREE.Layers()
      mainLayers.mask = cameraLayers.mask
      mainLayers.disable(particlesLayer)
      scenePass.setLayers(mainLayers)
    }

    // AO scene pass: same scene, but excluding objects on the aoExcludeLayer
    const aoScenePass = aoAllowed ? pass(scene, camera) : undefined
    if (aoScenePass) {
      aoScenePass.setResolutionScale(resolutionScale)
      const aoLayers = new THREE.Layers()
      aoLayers.mask = scenePass.getLayers().mask
      aoLayers.disable(aoExcludeLayer)
      aoScenePass.setLayers(aoLayers)
    }

    const particlesPass = particlesLayer !== undefined ? pass(scene, camera, {
      colorSpace: THREE.LinearSRGBColorSpace,
    }) : undefined
    if (particlesPass) {
      const particlesLayers = new THREE.Layers()
      particlesLayers.mask = 0
      particlesLayers.enable(particlesLayer)
      particlesPass.setLayers(particlesLayers)
    }

    const testingNormal = asType<boolean>(false)
    const testingAoNormal = asType<boolean>(false)

    const needsNormal = testingNormal || ((aoAllowed || ssgiAllowed) && !aoScenePass) || ssrAllowed || dofAllowed
    const aoNeedsNormal = testingAoNormal || ((aoAllowed || ssgiAllowed) && !!aoScenePass)
    const needsEmissive = asType<boolean>(false) && bloomAllowed
    const needsMetalness = asType<boolean>(true) && ssrAllowed
    const needsRoughness = asType<boolean>(true) && ssrAllowed

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
        const pass = aoScenePass ? aoScenePass : scenePass
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
        const scenePassDepth = scenePass.getTextureNode('depth')
        const scenePassNormal = scenePass.getTextureNode('normal')
        const scenePassMetalness = scenePass.getTextureNode('metalness')
        const scenePassRoughness = scenePass.getTextureNode('roughness')

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
    //renderPipeline.needsUpdate = true

    return renderPipeline
  }, [
    gl,
    scene,
    camera,
    gpuTier.tier,
    aoAllowed,
    bloomAllowed,
    dofAllowed,
    enableContrast,
    enableVignette,
  ])

  useEffect(() => {
    return () => {
      pipeline?.dispose()
    }
  }, [pipeline])

  // Take over rendering so R3F doesn't also do its normal gl.render(scene, camera).
  useFrame(({ gl }) => {
    if (pipeline) {
      //gl.clear()
      pipeline.render()
    }
  }, 1)

  return null
}
