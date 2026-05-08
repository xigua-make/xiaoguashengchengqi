import newColorData from '../app/api/palettes/newColorData.json';

export interface BrandColor {
  color: string;
  colorCode: string;
  displayOrder: number;
}

export interface Brand {
  id: number;
  brandCode: string;
  brandName: string;
  groupName: string;
  orderNo: number;
  master: boolean;
  type: number;
}

export interface NewColorData {
  brands: Brand[];
  colorCards: Record<string, BrandColor[]>;
}

// 从 newColorData 中提取所有品牌和预设
export function getWorkstationBrands(): Brand[] {
  return newColorData.brands;
}

// 获取指定品牌的所有颜色
export function getBrandColors(brandId: string): BrandColor[] {
  return newColorData.colorCards[brandId] || [];
}

// 获取品牌代码到品牌ID的映射
export function getBrandCodeToIdMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  newColorData.brands.forEach(brand => {
    mapping[brand.brandCode] = String(brand.id);
  });
  return mapping;
}

// 获取品牌ID到品牌代码的映射
export function getBrandIdToCodeMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  newColorData.brands.forEach(brand => {
    mapping[String(brand.id)] = brand.brandCode;
  });
  return mapping;
}

// 获取所有品牌组
export function getBrandGroups(): string[] {
  const groups = new Set(newColorData.brands.map(b => b.groupName));
  return Array.from(groups).sort((a, b) => {
    // 按照 orderNo 排序
    const aBrand = newColorData.brands.find(b => b.groupName === a);
    const bBrand = newColorData.brands.find(b => b.groupName === b);
    return (aBrand?.orderNo || 0) - (bBrand?.orderNo || 0);
  });
}

// 获取指定品牌组的所有品牌
export function getBrandsByGroup(groupName: string): Brand[] {
  return newColorData.brands
    .filter(b => b.groupName === groupName)
    .sort((a, b) => a.orderNo - b.orderNo);
}

// 获取主品牌（master: true）
export function getMasterBrands(): Brand[] {
  return newColorData.brands.filter(b => b.master);
}

// 获取品牌代码对应的颜色数量
export function getColorCountByBrandCode(brandCode: string): number {
  const brand = newColorData.brands.find(b => b.brandCode === brandCode);
  if (!brand) return 0;
  return newColorData.colorCards[String(brand.id)]?.length || 0;
}
