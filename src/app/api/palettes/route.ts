// ============================================
// 颜色数据 API - 使用新的 colors.json
// ============================================

import { NextResponse } from 'next/server';
import {
  getBrandsByGroup,
  getMasterBrands,
  getColorsByBrandId,
  getGroupDisplayName,
  getColorRgbMap,
  getOldBrandNames,
} from '@/lib/color-loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 获取按组分类的品牌
    const brandsByGroup = getBrandsByGroup();
    
    // 获取所有品牌
    const allBrands = Object.entries(brandsByGroup).map(([groupName, brands]) => ({
      groupName,
      displayName: getGroupDisplayName(groupName),
      brands: brands.map(b => ({
        id: b.id,
        brandCode: b.brandCode,
        brandName: b.brandName,
        colorCount: getColorsByBrandId(b.id).length,
        isMaster: b.master,
      })),
      // 默认使用 master 品牌
      defaultBrand: brands.find(b => b.master)?.brandCode || brands[0].brandCode,
    }));

    // 获取兼容的品牌列表（旧品牌名）
    const oldBrandNames = getOldBrandNames();
    
    // 获取各品牌主色的 RGB 映射
    const masterBrands = getMasterBrands();
    const brandRgbMaps: Record<string, Record<string, [number, number, number]>> = {};
    for (const brand of masterBrands) {
      brandRgbMaps[brand.groupName] = getColorRgbMap(brand.id);
    }

    // 获取默认品牌（MARD）的预设颜色
    const defaultGroup = 'Mard';
    const mardBrands = brandsByGroup[defaultGroup] || [];
    const mard221 = mardBrands.find(b => b.brandCode === 'Mard_221');
    let defaultColors: { code: string; rgb: [number, number, number]; hex: string }[] = [];
    if (mard221) {
      const colors = getColorsByBrandId(mard221.id);
      defaultColors = colors.map(c => ({
        code: c.colorCode,
        rgb: [
          parseInt(c.color.slice(1, 3), 16),
          parseInt(c.color.slice(3, 5), 16),
          parseInt(c.color.slice(5, 7), 16),
        ] as [number, number, number],
        hex: c.color,
      }));
    }

    return NextResponse.json({
      success: true,
      brandsByGroup: allBrands,
      oldBrandNames,
      brandRgbMaps,
      defaultColors,
    });
  } catch (error) {
    console.error('[palettes] Error loading palettes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load palettes' },
      { status: 500 }
    );
  }
}
