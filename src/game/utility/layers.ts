export function normalizeLayerList(layers: number | number[]): number[] {
  const normalized = Array.isArray(layers) ? layers : [layers]

  return [...new Set(normalized)]
    .filter((layer) => Number.isInteger(layer) && layer >= 0 && layer < 32)
    .sort((left, right) => left - right)
}
