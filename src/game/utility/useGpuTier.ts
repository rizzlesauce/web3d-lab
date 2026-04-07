import { useDetectGPU } from "@react-three/drei";
import { useMemo } from "react";
import { asType } from "./types";

export function searchParamValueToBoolean(searchParams: URLSearchParams, key: string) {
  const yesTerms = [
    '',
    'true',
    't',
    '1',
    'yes',
    'y',
  ];

  const value = searchParams.get(key);
  if (value !== null) {
    return yesTerms.includes(value.toLowerCase());
  }

  const valueNegated = searchParams.get(`no${key}`);
  if (valueNegated !== null) {
    return !yesTerms.includes(valueNegated.toLowerCase());
  }

  return;
}

export function useGpuTier() {
  const gpuTier = useDetectGPU();

  return useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
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

    const allowingHigherTier1Quality = searchParamValueToBoolean(searchParams, "hqTier1") ?? true;

    const isMobile = searchParamValueToBoolean(searchParams, "isMobile") ?? gpuTier.isMobile;

    const cubeCameraEnabled = searchParamValueToBoolean(searchParams, "cubeCamera") ?? (asType<boolean>(false) && isMobile);

    const truckEnabled = searchParamValueToBoolean(searchParams, "truck") ?? (!cubeCameraEnabled || isMobile);

    const forceGL = searchParamValueToBoolean(searchParams, "forceGL") ?? false;

    let shadowsType: 'none' | 'pcf' | 'basic' | 'soft' | 'vsm' = 'none';
    if (asType<boolean>(true) && tier >= 1) {
      shadowsType = 'pcf';
    } else if (asType<boolean>(true)) {
      shadowsType = 'basic';
    }
    const searchParamsShadowsTypeString = searchParams.get("shadows");
    if (searchParamsShadowsTypeString) {
      switch (searchParamsShadowsTypeString.toLowerCase()) {
        case "pcf":
          shadowsType = 'pcf';
          break;
        case "basic":
          shadowsType = 'basic';
          break;
        case "off":
        case "none":
          shadowsType = 'none';
          break;
        case "soft":
          shadowsType = 'soft';
          break;
        case "vsm":
          shadowsType = 'vsm';
          break;
      }
    }

    const postEnabled = searchParamValueToBoolean(searchParams, "post") ?? (tier >= 1);

    const aoEnabled = searchParamValueToBoolean(searchParams, "ao") ?? (tier >= 2 || (asType<boolean>(false) && allowingHigherTier1Quality && tier >= 1));

    const strict = searchParamValueToBoolean(searchParams, "strict") ?? true;

    const altTree = searchParamValueToBoolean(searchParams, "altTree") ?? (tier < 1);

    const samplesString = searchParams.get("samples");
    const samples = samplesString !== null
      ? parseInt(samplesString, 10)
      : (asType<boolean>(true)
        ? 0
        : tier >= 3 ? 4 : 2)

    return {
      ...gpuTier,
      tier,
      allowingHigherTier1Quality,
      isMobile,
      isIOS,
      isIPhone,
      isIPad,
      isNewerIPad,
      isIPod,
      cubeCameraEnabled,
      truckEnabled,
      forceGL,
      shadowsType,
      postEnabled,
      aoEnabled,
      strict,
      altTree,
      samples,
    };
  }, [gpuTier]);
}
