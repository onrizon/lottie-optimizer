import { optimize } from 'svgo/browser';
import type { Config } from 'svgo/browser';

export interface SVGOptimizationOptions {
  removeComments: boolean;
  removeMetadata: boolean;
  removeEditorsNSData: boolean;
  cleanupIds: boolean;
  removeEmptyAttrs: boolean;
  removeEmptyContainers: boolean;
  collapseGroups: boolean;
  removeUnusedNS: boolean;
  roundDecimals: boolean;
  decimalPrecision: number;
  // Alternative optimizations (off by default)
  convertShapeToPath: boolean;
  mergePaths: boolean;
  removeDimensions: boolean;
  removeDesc: boolean;
  removeTitle: boolean;
  sortAttrs: boolean;
}

export const defaultSVGOptions: SVGOptimizationOptions = {
  removeComments: true,
  removeMetadata: true,
  removeEditorsNSData: true,
  cleanupIds: true,
  removeEmptyAttrs: true,
  removeEmptyContainers: true,
  collapseGroups: true,
  removeUnusedNS: true,
  roundDecimals: true,
  decimalPrecision: 2,
  convertShapeToPath: false,
  mergePaths: false,
  removeDimensions: false,
  removeDesc: false,
  removeTitle: false,
  sortAttrs: false,
};

export interface SVGOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercentage: number;
  optimizedSVG: string;
}

export function optimizeSVG(svg: string, options: SVGOptimizationOptions): SVGOptimizationResult {
  const originalSize = new Blob([svg]).size;

  const overrides: Record<string, unknown> = {};

  if (!options.removeComments) overrides.removeComments = false;
  if (!options.removeMetadata) overrides.removeMetadata = false;
  if (!options.removeEditorsNSData) overrides.removeEditorsNSData = false;
  if (!options.cleanupIds) overrides.cleanupIds = false;
  if (!options.removeEmptyAttrs) overrides.removeEmptyAttrs = false;
  if (!options.removeEmptyContainers) overrides.removeEmptyContainers = false;
  if (!options.collapseGroups) overrides.collapseGroups = false;
  if (!options.removeUnusedNS) overrides.removeUnusedNS = false;

  if (!options.convertShapeToPath) overrides.convertShapeToPath = false;
  if (!options.mergePaths) overrides.mergePaths = false;
  if (!options.removeDesc) overrides.removeDesc = false;
  if (!options.sortAttrs) overrides.sortAttrs = false;

  if (options.roundDecimals) {
    overrides.cleanupNumericValues = { floatPrecision: options.decimalPrecision };
    overrides.convertPathData = { floatPrecision: options.decimalPrecision };
    overrides.convertTransform = { floatPrecision: options.decimalPrecision };
  } else {
    overrides.cleanupNumericValues = false;
  }

  const plugins: NonNullable<Config['plugins']> = [
    { name: 'preset-default', params: { overrides } },
  ];

  if (options.removeDimensions) plugins.push('removeDimensions');
  if (options.removeTitle) plugins.push('removeTitle');

  let optimizedSVG = svg;
  try {
    const result = optimize(svg, { plugins, multipass: true });
    optimizedSVG = result.data;
  } catch {
    optimizedSVG = svg;
  }

  const optimizedSize = new Blob([optimizedSVG]).size;

  const finalSVG = optimizedSize > originalSize ? svg : optimizedSVG;
  const finalSize = optimizedSize > originalSize ? originalSize : optimizedSize;

  return {
    originalSize,
    optimizedSize: finalSize,
    savings: originalSize - finalSize,
    savingsPercentage: originalSize > 0 ? ((originalSize - finalSize) / originalSize) * 100 : 0,
    optimizedSVG: finalSVG,
  };
}

export function validateSVG(svg: string): boolean {
  if (typeof svg !== 'string' || svg.trim().length === 0) return false;
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return false;
    const root = doc.documentElement;
    return root?.tagName?.toLowerCase() === 'svg';
  } catch {
    return false;
  }
}
