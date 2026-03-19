import { useDetectGPU } from "@react-three/drei";
import { useSearchParams } from "react-router-dom";

export function useGpuTier() {
  const gpuTier = useDetectGPU();
  const [searchParams, _setSearchParams] = useSearchParams();

  const ua = navigator.userAgent;
  //const isIPhone = /iPhone/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  let { tier } = gpuTier;
  if (isIOS) {
    tier = 0;
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
  };
}
