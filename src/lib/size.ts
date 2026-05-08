/**
 * 尺寸计算工具
 * 前后端共用，确保尺寸计算口径一致
 */

export interface Size {
  width: number;
  height: number;
}

/**
 * 根据最大边长和原始图片尺寸，计算等比缩放后的尺寸
 * 
 * @param maxSide - 最大边长（滑杆控制的尺寸）
 * @param imageWidth - 原始图片宽度
 * @param imageHeight - 原始图片高度
 * @returns 缩放后的 { width, height }
 */
export function calculateProportionalSize(
  maxSide: number,
  imageWidth: number,
  imageHeight: number
): Size {
  // 边界处理
  if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
    return { width: maxSide, height: maxSide };
  }

  // 保持宽高比
  const ratio = imageWidth / imageHeight;

  if (ratio >= 1) {
    // 宽图：宽度等于最大边
    const width = maxSide;
    const height = Math.max(1, Math.round(maxSide / ratio));
    return { width, height };
  } else {
    // 高图：高度等于最大边
    const height = maxSide;
    const width = Math.max(1, Math.round(maxSide * ratio));
    return { width, height };
  }
}

/**
 * 根据像素图尺寸和珠子大小，计算实际物理尺寸（毫米）
 */
export function calculatePhysicalSize(
  pixelWidth: number,
  pixelHeight: number,
  beadSizeMm: number = 5
): { widthMm: number; heightMm: number } {
  return {
    widthMm: pixelWidth * beadSizeMm,
    heightMm: pixelHeight * beadSizeMm
  };
}

/**
 * 根据最大边长确定限色数量
 */
export function getColorCount(maxSide: number): number {
  if (maxSide <= 56) {
    return 16;
  } else if (maxSide <= 80) {
    return 20;
  } else {
    return 24;
  }
}

/**
 * 验证尺寸参数是否合理
 */
export function validateSize(width: number, height: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return { valid: false, error: '尺寸必须为整数' };
  }

  if (width < 1 || height < 1) {
    return { valid: false, error: '尺寸不能小于1' };
  }

  if (width > 200 || height > 200) {
    return { valid: false, error: '尺寸过大（最大200像素）' };
  }

  return { valid: true };
}
