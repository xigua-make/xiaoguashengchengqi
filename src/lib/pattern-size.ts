/**
 * 拼豆图纸尺寸计算工具
 * 前后端共用，确保「滑杆值 -> 最终图纸尺寸」口径一致。
 */

export interface Size {
  width: number;
  height: number;
}

export type AiMode = 'pixelFullBody' | 'pixelPortrait' | 'pixelDoll' | 'cartoon' | string;

export const MIN_PATTERN_SIDE = 10;
export const MAX_PATTERN_SIDE = 300;
export const DEFAULT_PATTERN_SIDE = 60;

const SQUARE_PATTERN_MODES = new Set(['pixelPortrait', 'pixelDoll', 'cutePet', 'cartoon', 'carStyle']);

export function isSquarePatternMode(aiMode: AiMode): boolean {
  return SQUARE_PATTERN_MODES.has(String(aiMode));
}

export function normalizeMaxSide(value: unknown, fallback: number = DEFAULT_PATTERN_SIDE): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(MIN_PATTERN_SIDE, Math.min(MAX_PATTERN_SIDE, Math.round(n)));
}

/**
 * 像素大头专用：滑杆值 N = N x N。
 */
export function getPixelPortraitTargetSize(sliderValue: number): Size {
  const side = normalizeMaxSide(sliderValue);
  return { width: side, height: side };
}

/**
 * 根据最大边长和原始图片尺寸，计算等比缩放后的尺寸。
 */
export function calculateProportionalSize(
  maxSide: number,
  imageWidth: number,
  imageHeight: number
): Size {
  const safeMaxSide = normalizeMaxSide(maxSide);

  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
    return { width: safeMaxSide, height: safeMaxSide };
  }

  const ratio = imageWidth / imageHeight;

  if (ratio >= 1) {
    return {
      width: safeMaxSide,
      height: Math.max(1, Math.round(safeMaxSide / ratio)),
    };
  }

  return {
    width: Math.max(1, Math.round(safeMaxSide * ratio)),
    height: safeMaxSide,
  };
}

/**
 * 最终图纸尺寸规则：
 * - pixelPortrait / pixelDoll：滑杆值 N = N x N。
 * - pixelFullBody / cartoon：最大边 = N，另一边按 AI 图真实比例计算。
 */
export function calculateTargetSizeForMode(
  aiMode: AiMode,
  maxSide: number,
  imageWidth?: number,
  imageHeight?: number
): Size {
  const safeMaxSide = normalizeMaxSide(maxSide);

  if (isSquarePatternMode(aiMode)) {
    return { width: safeMaxSide, height: safeMaxSide };
  }

  return calculateProportionalSize(safeMaxSide, imageWidth || 0, imageHeight || 0);
}

/**
 * /api/optimize-image 的尺寸提示。
 * Seedream 实际输出仍可为 2048 x 2048，但 prompt 必须知道用户当前滑杆值。
 */
export function calculateOptimizeTargetSize(aiMode: AiMode, maxSide: number): Size & { targetSize: number } {
  const safeMaxSide = normalizeMaxSide(maxSide);
  return {
    width: safeMaxSide,
    height: safeMaxSide,
    targetSize: safeMaxSide,
  };
}

export interface PixelPortraitSpec {
  targetSize: number;
  nColors: number;
  maxDarkRatio: number;
  minHeadRatio: number;
  cleanupLevel: 'strong' | 'medium' | 'light';
  styleLevel: 'ultra_simple' | 'simple' | 'standard' | 'rich' | 'detailed';
  minRegionPixels: number;
}

/**
 * 像素大头专用规格。
 * 尺寸越小，越要减少颜色、压低暗色占比、增强清理。
 */
export function getPixelPortraitSpec(sizeInput: number): PixelPortraitSpec {
  const size = normalizeMaxSide(sizeInput);

  if (size <= 24) {
    return {
      targetSize: size,
      nColors: 8,
      maxDarkRatio: 0.22,
      minHeadRatio: 0.78,
      cleanupLevel: 'strong',
      styleLevel: 'ultra_simple',
      minRegionPixels: 2,
    };
  }

  if (size <= 40) {
    return {
      targetSize: size,
      nColors: 10,
      maxDarkRatio: 0.25,
      minHeadRatio: 0.74,
      cleanupLevel: 'strong',
      styleLevel: 'simple',
      minRegionPixels: 2,
    };
  }

  if (size <= 56) {
    return {
      targetSize: size,
      nColors: 12,
      maxDarkRatio: 0.28,
      minHeadRatio: 0.70,
      cleanupLevel: 'strong',
      styleLevel: 'simple',
      minRegionPixels: 3,
    };
  }

  if (size <= 80) {
    return {
      targetSize: size,
      nColors: 16,
      maxDarkRatio: 0.32,
      minHeadRatio: 0.66,
      cleanupLevel: 'medium',
      styleLevel: 'standard',
      minRegionPixels: 4,
    };
  }

  if (size <= 120) {
    return {
      targetSize: size,
      nColors: 20,
      maxDarkRatio: 0.35,
      minHeadRatio: 0.62,
      cleanupLevel: 'medium',
      styleLevel: 'rich',
      minRegionPixels: 5,
    };
  }

  return {
    targetSize: size,
    nColors: 24,
    maxDarkRatio: 0.38,
    minHeadRatio: 0.58,
    cleanupLevel: 'light',
    styleLevel: 'detailed',
    minRegionPixels: 5,
  };
}

/**
 * 根据像素图尺寸和珠子大小，计算实际物理尺寸（毫米）。
 */
export function calculatePhysicalSize(
  pixelWidth: number,
  pixelHeight: number,
  beadSizeMm: number = 5
): { widthMm: number; heightMm: number } {
  return {
    widthMm: pixelWidth * beadSizeMm,
    heightMm: pixelHeight * beadSizeMm,
  };
}

/**
 * 通用限色数量。pixelPortrait 请优先使用 getPixelPortraitSpec(size).nColors。
 */
export function getColorCount(maxSide: number): number {
  const safeMaxSide = normalizeMaxSide(maxSide);
  if (safeMaxSide <= 24) return 8;
  if (safeMaxSide <= 40) return 10;
  if (safeMaxSide <= 56) return 12;
  if (safeMaxSide <= 80) return 16;
  if (safeMaxSide <= 120) return 20;
  return 24;
}

/**
 * 验证尺寸参数是否合理。
 */
export function validateSize(width: number, height: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { valid: false, error: '尺寸必须为整数' };
  }

  if (width < MIN_PATTERN_SIDE || height < MIN_PATTERN_SIDE) {
    return { valid: false, error: `尺寸不能小于${MIN_PATTERN_SIDE}` };
  }

  if (width > MAX_PATTERN_SIDE || height > MAX_PATTERN_SIDE) {
    return { valid: false, error: `尺寸过大（最大${MAX_PATTERN_SIDE}像素）` };
  }

  return { valid: true };
}
