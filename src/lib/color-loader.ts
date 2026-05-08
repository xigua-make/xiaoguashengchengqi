// ============================================
// 新的色号库加载模块（从 colors.json）
// ============================================

import colorData from '@/data/colors.json';

export interface ColorItem {
  color: string;      // hex 颜色值，如 #FBED56
  colorCode: string;  // 色号，如 A4
  displayOrder: number;
}

export interface BrandInfo {
  id: number;
  brandCode: string;   // 如 Mard_24
  brandName: string;    // 如 Mard-24
  groupName: string;   // 如 Mard
  orderNo: number;
  master: boolean;
  type: number;
}

// 品牌组名映射（用于兼容现有代码）
// 新品牌组 -> 旧品牌名
const BRAND_GROUP_MAP: Record<string, string> = {
  'Mard': 'MARD',
  '黄豆豆': '黄豆豆',
  'DoDo': 'DoDo',
  'CoCo': 'COCO',
  '漫漫': '漫漫',
  '小舞': '小舞',
  '咪小窝': '咪小窝',
  '卡卡': '卡卡',
  '优肯': '优肯',
  '柿柿': '柿柿',
  '童趣': '童趣',
  '盼盼': '盼盼',
};

// 旧品牌名 -> 新品牌组（反向映射）
const REVERSE_BRAND_MAP: Record<string, string> = {
  'MARD': 'Mard',
  'COCO': 'CoCo',
  '漫漫': '漫漫',
  '盼盼': '盼盼',
  '咪小窝': '咪小窝',
};

// 获取所有品牌
export function getAllBrands(): BrandInfo[] {
  return colorData.brands as BrandInfo[];
}

// 获取按组分类的品牌
export function getBrandsByGroup(): Record<string, BrandInfo[]> {
  const groups: Record<string, BrandInfo[]> = {};
  for (const brand of colorData.brands) {
    const groupName = brand.groupName;
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(brand);
  }
  // 按 orderNo 排序
  for (const group of Object.values(groups)) {
    group.sort((a, b) => a.orderNo - b.orderNo);
  }
  return groups;
}

// 获取主品牌（每个组的 master=true 的品牌）
export function getMasterBrands(): BrandInfo[] {
  return (colorData.brands as BrandInfo[]).filter(b => b.master);
}

// 根据 brandId 获取颜色列表
export function getColorsByBrandId(brandId: number): ColorItem[] {
  const cards = colorData.colorCards as Record<string, ColorItem[]>;
  return cards[String(brandId)] || [];
}

// 根据 brandCode 获取颜色列表
export function getColorsByBrandCode(brandCode: string): ColorItem[] {
  const brand = (colorData.brands as BrandInfo[]).find(b => b.brandCode === brandCode);
  if (!brand) return [];
  return getColorsByBrandId(brand.id);
}

// 根据 groupName 获取主品牌的颜色
export function getColorsByGroupName(groupName: string): ColorItem[] {
  const masterBrand = (colorData.brands as BrandInfo[]).find(
    b => b.groupName === groupName && b.master
  );
  if (!masterBrand) return [];
  return getColorsByBrandId(masterBrand.id);
}

// 根据旧品牌名（如 MARD, COCO）获取主品牌颜色
export function getColorsByOldBrandName(brandName: string): ColorItem[] {
  const groupName = REVERSE_BRAND_MAP[brandName];
  if (!groupName) return [];
  return getColorsByGroupName(groupName);
}

// 转换为通用格式（用于组件显示）
export interface DisplayColor {
  code: string;        // 色号
  hex: string;         // hex 颜色
  rgb: [number, number, number];  // RGB 数组
  brandCode: string;    // 当前品牌代码
  brandId: number;      // 当前品牌 ID
}

export function getDisplayColors(brandId: number): DisplayColor[] {
  const colors = getColorsByBrandId(brandId);
  return colors.map(c => ({
    code: c.colorCode,
    hex: c.color,
    rgb: hexToRgb(c.color),
    brandCode: (colorData.brands as BrandInfo[]).find(b => b.id === brandId)?.brandCode || '',
    brandId,
  }));
}

// 辅助函数：hex 转 RGB
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const bigint = parseInt(clean, 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255,
  ];
}

// 转换为颜色映射（key: 色号, value: RGB）
export function getColorRgbMap(brandId: number): Record<string, [number, number, number]> {
  const colors = getColorsByBrandId(brandId);
  const rgbMap: Record<string, [number, number, number]> = {};
  for (const c of colors) {
    rgbMap[c.colorCode] = hexToRgb(c.color);
  }
  return rgbMap;
}

// 获取品牌组名（中文显示名）
export function getGroupDisplayName(groupName: string): string {
  return BRAND_GROUP_MAP[groupName] || groupName;
}

// 所有品牌组
export function getAllGroupNames(): string[] {
  const groups = getBrandsByGroup();
  return Object.keys(groups);
}

// 获取品牌的主品牌（master=true）
export function getMasterBrandByGroup(groupName: string): BrandInfo | undefined {
  return (colorData.brands as BrandInfo[]).find(
    b => b.groupName === groupName && b.master
  );
}

// 获取品牌的所有可用预设
export function getBrandPresets(groupName: string): BrandInfo[] {
  const brands = (colorData.brands as BrandInfo[]).filter(b => b.groupName === groupName);
  return brands.sort((a, b) => a.orderNo - b.orderNo);
}

// 获取预设的颜色数量
export function getPresetColorCount(brandCode: string): number {
  const brand = (colorData.brands as BrandInfo[]).find(b => b.brandCode === brandCode);
  if (!brand) return 0;
  const colors = getColorsByBrandId(brand.id);
  return colors.length;
}

// 获取旧品牌名列表（兼容现有代码）
export function getOldBrandNames(): string[] {
  return Object.keys(REVERSE_BRAND_MAP);
}
