import { optimize } from 'svgo/browser';
import type { Config } from 'svgo/browser';

export interface SVGOptimizationOptions {
  removeComments: boolean;
  removeMetadata: boolean;
  removeEditorsNSData: boolean;
  cleanupIds: boolean;
  idPrefix: string;
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
  setDimensions100: boolean;
  prefixClasses: boolean;
  classPrefix: string;
  removeDesc: boolean;
  removeTitle: boolean;
  sortAttrs: boolean;
}

export const defaultSVGOptions: SVGOptimizationOptions = {
  removeComments: true,
  removeMetadata: true,
  removeEditorsNSData: true,
  cleanupIds: true,
  idPrefix: '',
  removeEmptyAttrs: true,
  removeEmptyContainers: true,
  collapseGroups: true,
  removeUnusedNS: true,
  roundDecimals: true,
  decimalPrecision: 2,
  convertShapeToPath: false,
  mergePaths: false,
  removeDimensions: false,
  setDimensions100: false,
  prefixClasses: false,
  classPrefix: '',
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

/**
 * Sets width="100%" height="100%" on the root <svg> element.
 * Replaces existing values if present, adds them if missing.
 */
function applyDimensions100(svg: string): string {
  const svgStart = svg.indexOf('<svg');
  if (svgStart === -1) return svg;
  const tagEnd = svg.indexOf('>', svgStart);
  if (tagEnd === -1) return svg;

  let tag = svg.slice(svgStart, tagEnd + 1);

  if (/\bwidth="/.test(tag)) {
    tag = tag.replace(/\bwidth="[^"]*"/, 'width="100%"');
  } else {
    tag = tag.replace('<svg', '<svg width="100%"');
  }

  if (/\bheight="/.test(tag)) {
    tag = tag.replace(/\bheight="[^"]*"/, 'height="100%"');
  } else {
    tag = tag.replace('<svg', '<svg height="100%"');
  }

  return svg.slice(0, svgStart) + tag + svg.slice(tagEnd + 1);
}

/**
 * Prefixes every id="..." in the SVG and updates all internal references
 * (url(#id), href="#id", xlink:href="#id") to match.
 * Runs as a post-processing step after SVGO so that IDs the optimizer
 * keeps unchanged (e.g. the root <svg> id) also get the prefix.
 */
function applyIdPrefix(svg: string, prefix: string): string {
  // Collect all id values present in the output
  const ids = new Set<string>();
  const idAttrRe = /\bid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = idAttrRe.exec(svg)) !== null) ids.add(m[1]);

  if (ids.size === 0) return svg;

  // Sort longest-first to avoid partial replacements
  const sorted = [...ids].sort((a, b) => b.length - a.length);

  let result = svg;
  for (const id of sorted) {
    const newId = prefix + id;
    // id="..."
    result = result.replaceAll(`id="${id}"`, `id="${newId}"`);
    // href="#..."
    result = result.replaceAll(`href="#${id}"`, `href="#${newId}"`);
    // xlink:href="#..."
    result = result.replaceAll(`xlink:href="#${id}"`, `xlink:href="#${newId}"`);
    // url(#...)  — with or without quotes
    result = result.replaceAll(`url(#${id})`, `url(#${newId})`);
    result = result.replaceAll(`url("#${id}")`, `url("#${newId}")`);
    result = result.replaceAll(`url('#${id}')`, `url('#${newId}')`);
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Prefixes every class name in class="..." attributes and updates the
 * corresponding CSS selectors inside <style> blocks.
 *
 * CSS replacement is scoped to <style>...</style> blocks only — running the
 * selector regex on the full SVG string would accidentally match decimal
 * values that SVGO compresses (e.g. opacity=".5", path d="M0 .5 L1 .5").
 *
 * Longest-first sort avoids partial substitution (e.g. "foo" touching "foobar").
 */
function applyClassPrefix(svg: string, prefix: string): string {
  const classes = new Set<string>();
  const classAttrRe = /\bclass="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = classAttrRe.exec(svg)) !== null) {
    for (const cls of m[1].trim().split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }

  if (classes.size === 0) return svg;

  const sorted = [...classes].sort((a, b) => b.length - a.length);

  // 1. Prefix class="..." attribute values (safe — stays within quoted value)
  let result = svg;
  for (const cls of sorted) {
    const esc = escapeRegex(cls);
    const newCls = prefix + cls;
    result = result.replace(
      new RegExp(`(class="[^"]*?)\\b${esc}\\b`, 'g'),
      `$1${newCls}`,
    );
  }

  // 2. Prefix .selector rules ONLY inside <style> blocks
  result = result.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
    let updatedCss = css;
    for (const cls of sorted) {
      const esc = escapeRegex(cls);
      const newCls = prefix + cls;
      updatedCss = updatedCss.replace(
        new RegExp(`\\.${esc}(?![\\w-])`, 'g'),
        `.${newCls}`,
      );
    }
    return `<style${attrs}>${updatedCss}</style>`;
  });

  return result;
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

  if (options.cleanupIds && options.idPrefix) {
    optimizedSVG = applyIdPrefix(optimizedSVG, options.idPrefix);
  }

  if (options.setDimensions100) {
    optimizedSVG = applyDimensions100(optimizedSVG);
  }

  if (options.prefixClasses && options.classPrefix) {
    optimizedSVG = applyClassPrefix(optimizedSVG, options.classPrefix);
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
