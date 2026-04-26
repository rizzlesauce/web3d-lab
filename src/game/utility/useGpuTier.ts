import { useDetectGPU } from "@react-three/drei";
import { useMemo } from "react";
import { asType } from "./types";
import { useLocationHash } from "./useLocationHash";

export function getKeyIgnoreCase(searchParams: URLSearchParams, key: string) {
  const lowerKey = key.toLowerCase();
  for (const k of searchParams.keys()) {
    if (k.toLowerCase() === lowerKey) {
      return k;
    }
  }
  return '';
}

export function getSearchParamValueIgnoreCase(searchParams: URLSearchParams, key: string) {
  const foundKey = getKeyIgnoreCase(searchParams, key);
  return searchParams.get(foundKey);
}

export function searchParamValueToBoolean(searchParams: URLSearchParams, key: string) {
  const yesTerms = [
    '',
    'true',
    't',
    '1',
    'yes',
    'y',
  ];

  const value = getSearchParamValueIgnoreCase(searchParams, key);
  if (value !== null) {
    return yesTerms.includes(value.toLowerCase());
  }

  const valueNegated = getSearchParamValueIgnoreCase(searchParams, `no${key.toLowerCase()}`);
  if (valueNegated !== null) {
    return !yesTerms.includes(valueNegated.toLowerCase());
  }

  return;
}

const searchParams = new URLSearchParams(window.location.search);

export function useGpuTier() {
  const gpuTier = useDetectGPU();
  const locationHash = useLocationHash();

  return useMemo(() => {
    const hashParams = new URLSearchParams(locationHash);

    const paramToBoolean = (param: string) => {
      return searchParamValueToBoolean(hashParams, param)
        ?? searchParamValueToBoolean(searchParams, param);
    };

    const paramToString = (param: string) => {
      return hashParams.get(param) ?? searchParams.get(param);
    };

    const paramToInt = (param: string) => {
      const valueString = paramToString(param);
      if (valueString !== null) {
        const valueNumber = parseInt(valueString, 10);
        if (!isNaN(valueNumber)) {
          return valueNumber;
        }
      }
    };

    const ua = navigator.userAgent;
    const isIPhone = /iPhone/i.test(ua);
    const isIPad = /iPad/i.test(ua);
    const isIPod = /iPod/i.test(ua);
    const isIOS = isIPhone || isIPad || isIPod;

    // Check for newer iPads that report as Mac, but have touch capabilities
    const isNewerIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

    let tier = gpuTier.tier;
    if (isIPhone || isIPod) {
      tier = 0;
    } else if (isIPad && gpuTier.tier > 1) {
      tier = 1;
    } else if (isNewerIPad && gpuTier.tier > 2) {
      tier = 2;
    }

    tier = paramToInt("tier") ?? tier;

    const allowingHigherTier1Quality = paramToBoolean("hqTier1") ?? true;

    const isMobile = paramToBoolean("isMobile") ?? gpuTier.isMobile;

    const cubeCameraEnabled = paramToBoolean("cubeCamera") ?? (asType<boolean>(true) && isMobile);

    const truckEnabled = paramToBoolean("truck") ?? (!cubeCameraEnabled || isMobile);

    const forceGL = paramToBoolean("forceGL") ?? false;

    let shadowsType: 'none' | 'pcf' | 'basic' | 'soft' | 'vsm' = 'none';
    if (asType<boolean>(true) && tier >= 1) {
      shadowsType = 'pcf';
    } else if (asType<boolean>(true)) {
      shadowsType = 'basic';
    }
    const searchParamsShadowsTypeString = paramToString("shadows");
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

    const postEnabled = paramToBoolean("post") ?? (tier >= 1);

    const aoEnabled = paramToBoolean("ao") ?? (tier >= 2 || (asType<boolean>(false) && allowingHigherTier1Quality && tier >= 1));

    const ssrEnabled = paramToBoolean("ssr") ?? (tier >= 2 || (asType<boolean>(true) && allowingHigherTier1Quality && tier >= 1));

    const strict = paramToBoolean("strict") ?? true;

    const altTree = paramToBoolean("altTree") ?? (tier < 1);

    const samples = paramToInt("samples") ?? (
      asType<boolean>(true)
        ? 0
        : tier >= 3 ? 4 : 2
    );

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
      ssrEnabled,
      strict,
      altTree,
      samples,
    };
  }, [
    gpuTier,
    locationHash,
  ]);
}
