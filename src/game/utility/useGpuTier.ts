import { useDetectGPU } from "@react-three/drei";

export function useGpuTier() {
  const gpuTier = useDetectGPU();

  const ua = navigator.userAgent;
  //const isIPhone = /iPhone/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  return {
    ...gpuTier,
    tier: isIOS ? 0 : gpuTier.tier,
  };
}
