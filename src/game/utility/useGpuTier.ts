import { useDetectGPU } from "@react-three/drei";
import { useSearchParams } from "react-router-dom";

export function useGpuTier() {
  const gpuTier = useDetectGPU();
  const [searchParams, _setSearchParams] = useSearchParams();

  const ua = navigator.userAgent;
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua);
  const isIPod = /iPod/i.test(ua);
  const isIOS = isIPhone || isIPad || isIPod;

  // Check for newer iPads that report as Mac, but have touch capabilities
  const isNewerIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  let { tier } = gpuTier;
  if (isIPhone || isIPod) {
    tier = 0;
  } else if (isIPad && gpuTier.tier > 1) {
    tier = 1;
  } else if (isNewerIPad && gpuTier.tier > 2) {
    tier = 2;
  }

  const searchParamsTierString = searchParams.get("tier");
  if (searchParamsTierString) {
    const searchParamsTier = parseInt(searchParamsTierString, 10);
    if (!isNaN(searchParamsTier)) {
      tier = searchParamsTier;
    }
  }

  return {
    ...gpuTier,
    tier,
    isIOS,
    isIPhone,
    isIPad,
    isNewerIPad,
    isIPod,
  };
}
