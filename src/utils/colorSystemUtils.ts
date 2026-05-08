import { PaletteColor } from './pixelation';
import colorSystemMapping from '../app/colorSystemMapping.json';

// 导入 newColorData（图片直接识别专用色板）
import newColorData from '../app/api/palettes/newColorData.json';

// 定义色号系统类型
export type ColorSystem = string; // 支持所有品牌

// Brand ID 映射 (用于兼容旧代码)
// key 必须与 getWorkstationColorSystems() 返回的 groupName 一致
const BRAND_ID_MAP: Record<string, string> = {
  'Mard': '9',        // MARD 291
  'CoCo': '37',       // COCO 293
  '漫漫': '38',       // 漫漫
  '盼盼': '47',      // 盼盼 291
  '咪小窝': '41',    // 咪小窝 292
  '卡卡': '42',      // 卡卡 286
  '优肯': '431',     // 优肯 418
  '黄豆豆': '16',    // 黄豆豆 168
  'DoDo': '27',      // DoDo 290
  '小舞': '39',      // 小舞 290
  '柿柿': '45',      // 柿柿
  '童趣': '46',      // 童趣
};

// 从 newColorData 动态获取所有品牌（图片直接识别专用）
export function getWorkstationColorSystems(): { key: string; name: string }[] {
  // 从 newColorData.brands 获取所有品牌，按 orderNo 排序
  const brands = newColorData.brands || [];
  // 只取每个 groupName 的 master=true 的品牌作为主品牌
  const masterBrands = brands.filter((b: any) => b.master === true);
  return masterBrands
    .sort((a: any, b: any) => (a.orderNo || 0) - (b.orderNo || 0))
    .map((b: any) => ({
      key: b.groupName,
      name: b.groupName
    }));
}

// 兼容旧代码：静态色号系统选项（AI转像素模块使用）
export const colorSystemOptions = [
  { key: 'MARD', name: 'MARD' },
  { key: 'COCO', name: 'COCO' },
  { key: '漫漫', name: '漫漫' },
  { key: '盼盼', name: '盼盼' },
  { key: '咪小窝', name: '咪小窝' },
  { key: 'KaKa', name: '卡卡' },
  { key: '优肯', name: '优肯' },
  { key: '黄豆豆', name: '黄豆豆' },
  { key: 'DoDo', name: 'DoDo' },
  { key: '小舞', name: '小舞' },
  { key: '柿柿', name: '柿柿' },
  { key: '童趣', name: '童趣' },
];

// 类型定义：新格式使用 brand ID 作为 key
type NewColorMapping = Record<string, Record<string, string>>;
const typedColorSystemMapping = colorSystemMapping as NewColorMapping;

// 获取所有可用的hex值
export function getAllHexValues(): string[] {
  return Object.keys(typedColorSystemMapping);
}

// 获取所有MARD色号到hex值的映射（用于向后兼容）
export function getMardToHexMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  Object.entries(typedColorSystemMapping).forEach(([hex, colorData]) => {
    const mardCode = colorData['9']; // MARD 使用 brand ID '9'
    if (mardCode) {
      mapping[mardCode] = hex;
    }
  });
  return mapping;
}

// 从colorSystemMapping.json加载完整的颜色映射数据
export function loadFullColorMapping(): Map<string, Record<string, string>> {
  const mapping = new Map<string, Record<string, string>>();
  Object.entries(colorSystemMapping).forEach(([baseKey, colorData]) => {
    mapping.set(baseKey, colorData as Record<string, string>);
  });
  return mapping;
}

// 将色板转换到指定色号系统
export function convertPaletteToColorSystem(
  palette: PaletteColor[],
  colorSystem: ColorSystem
): PaletteColor[] {
  const brandId = BRAND_ID_MAP[colorSystem] || colorSystem;
  return palette.map(color => {
    const colorMapping = typedColorSystemMapping[color.hex];
    if (colorMapping && colorMapping[brandId]) {
      return {
        ...color,
        key: colorMapping[brandId]
      };
    }
    return color; // 如果找不到映射，保持原样
  });
}

// 获取指定色号系统的显示键 - 基于hex值的简化版本
export function getDisplayColorKey(hexValue: string, colorSystem: ColorSystem): string {
  // 对于特殊键（如透明键），直接返回原键
  if (hexValue === 'ERASE' || hexValue.length === 0 || hexValue === '?') {
    return hexValue;
  }

  // 标准化hex值（确保大写）
  const normalizedHex = hexValue.toUpperCase();

  // 获取 brand ID
  const brandId = BRAND_ID_MAP[colorSystem] || colorSystem;

  // 通过hex值从colorSystemMapping获取目标色号系统的值
  const colorMapping = typedColorSystemMapping[normalizedHex];
  if (colorMapping && colorMapping[brandId]) {
    return colorMapping[brandId];
  }

  // 如果找不到映射，返回 hex 值作为显示的"色号"
  return normalizedHex;
}

// 将色号键转换到hex值（支持任意色号系统）
export function convertColorKeyToHex(displayKey: string, colorSystem: ColorSystem): string {
  // 如果已经是hex值，直接返回
  if (displayKey.startsWith('#') && displayKey.length === 7) {
    return displayKey.toUpperCase();
  }
  
  // 获取 brand ID
  const brandId = BRAND_ID_MAP[colorSystem] || colorSystem;
  
  // 在colorSystemMapping中查找对应的hex值
  for (const [hex, mapping] of Object.entries(typedColorSystemMapping)) {
    if (mapping[brandId] === displayKey) {
      return hex;
    }
  }
  
  return displayKey; // 如果找不到映射，返回原键
}

// 验证颜色在指定系统中是否有效
export function isValidColorInSystem(hexValue: string, colorSystem: ColorSystem): boolean {
  const brandId = BRAND_ID_MAP[colorSystem] || colorSystem;
  const mapping = typedColorSystemMapping[hexValue];
  return mapping && mapping[brandId] !== undefined;
}

// 通过hex值获取指定色号系统的色号
export function getColorKeyByHex(hexValue: string, colorSystem: ColorSystem): string {
  // 对于特殊键（如透明键），直接返回原键
  if (hexValue === 'ERASE' || hexValue.length === 0 || hexValue === '?') {
    return hexValue;
  }

  // 标准化hex值（确保大写）
  const normalizedHex = hexValue.toUpperCase();

  // 获取 brand ID
  const brandId = BRAND_ID_MAP[colorSystem] || colorSystem;

  // 查找映射
  const mapping = typedColorSystemMapping[normalizedHex];
  if (mapping && mapping[brandId]) {
    return mapping[brandId];
  }

  // 如果找不到映射，返回 hex 值作为显示的"色号"
  return normalizedHex;
}

// 将hex颜色转换为HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // 移除 # 符号
  const cleanHex = hex.replace('#', '');
  
  // 转换为RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// 按色相排序颜色
export function sortColorsByHue<T extends { color: string }>(colors: T[]): T[] {
  return colors.slice().sort((a, b) => {
    const hslA = hexToHsl(a.color);
    const hslB = hexToHsl(b.color);
    
    // 首先按色相排序
    if (Math.abs(hslA.h - hslB.h) > 5) { // 增加色相容差，让更相近的色相归为一组
      return hslA.h - hslB.h;
    }
    
    // 色相相近时，按明度排序（从浅到深）
    if (Math.abs(hslA.l - hslB.l) > 3) {
      return hslB.l - hslA.l; // 浅色（高明度）在前，深色（低明度）在后
    }
    
    // 明度也相近时，按饱和度排序（高饱和度在前，让鲜艳的颜色更突出）
    return hslB.s - hslA.s;
  });
}
