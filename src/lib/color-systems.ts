/**
 * 多品牌拼豆颜色系统
 *
 * 支持品牌：
 * - Mard (主品牌 ID: 9)
 * - CoCo (主品牌 ID: 37)
 * - 漫漫 (品牌 ID: 38)
 * - 盼盼 (品牌 ID: 47)
 * - 咪小窝 (主品牌 ID: 41)
 * - 卡卡 (品牌 ID: 42)
 * - 优肯 (主品牌 ID: 431)
 * - 黄豆豆 (主品牌 ID: 16)
 * - DoDo (主品牌 ID: 27)
 * - 小舞 (品牌 ID: 39)
 * - 柿柿 (品牌 ID: 45)
 * - 童趣 (品牌 ID: 46)
 *
 * 注意：
 * - paletteId 只对 MARD 生效（291/221/144/120 预设）
 * - 其他品牌忽略 paletteId，默认使用全部可用色
 * - nearestColor 只在传入的 allowedColors 中匹配
 */

// 使用 app 目录下的 colorSystemMapping.json
import colorSystemMapping from '@/app/colorSystemMapping.json';
// 使用新的颜色数据
import newColorData from '@/data/ai-newColorData.json';

export type BrandType = 
  | 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝'
  | 'KaKa' | '卡卡' | '优肯' | '黄豆豆' | 'DoDo' | '小舞'
  | '柿柿' | '童趣';

export type PresetId = 'all' | '291' | '221' | '144' | '120';

export interface ColorRecord {
  /** 标准色 HEX，统一为 #RRGGBB 大写 */
  hex: string;
  /** 标准色 RGB */
  rgb: [number, number, number];
  /** 在源 JSON 中的顺序，用于稳定截取 291/221/144/120 */
  index: number;
  codes: Record<BrandType, string | null>;
}

export interface PalettePreset {
  id: PresetId;
  name: string;
  description: string;
  brand: BrandType;
  colorCount: number;
}

export interface AllowedPaletteItem {
  masterCode: string;
  displayCode: string;
  brand: BrandType;
  hex: string;
  rgb: [number, number, number];
}

export const BRANDS: BrandType[] = [
  'MARD', 'COCO', '漫漫', '盼盼', '咪小窝',
  'KaKa', '卡卡', '优肯', '黄豆豆', 'DoDo', '小舞',
  '柿柿', '童趣'
];

export const PRESET_LIMITS: Record<Exclude<PresetId, 'all'>, number> = {
  '291': 291,
  '221': 221,
  '144': 144,
  '120': 120,
};

// Brand ID 映射 - 每个品牌使用其主品牌 ID
const BRAND_IDS: Record<BrandType, string[]> = {
  MARD: ['9'],       // Mard 291
  COCO: ['37'],      // CoCo 293
  漫漫: ['38'],      // 漫漫 216
  盼盼: ['47'],      // 盼盼 291
  咪小窝: ['41'],    // 咪小窝 292
  KaKa: ['42'],      // 卡卡 286
  卡卡: ['42'],      // 卡卡 286 (别名)
  优肯: ['43', '431', '44'],  // 优肯 (197/418/5MM)
  黄豆豆: ['16'],    // 黄豆豆 168
  DoDo: ['27'],      // DoDo 290
  小舞: ['39'],      // 小舞 290
  柿柿: ['45'],      // 柿柿
  童趣: ['46'],      // 童趣
};

// 类型定义：新的 mapping 格式是 { hex: { brandId: code } }
type NewRawColorMapping = Record<string, Record<string, string>>;

const mapping = colorSystemMapping as NewRawColorMapping;

function normalizeHex(hex: string): string {
  const clean = String(hex || '').trim().replace('#', '').toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(clean)) {
    throw new Error(`Invalid color hex: ${hex}`);
  }
  return `#${clean}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = normalizeHex(hex).slice(1);
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16),
  ];
}

function normalizeCode(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const value = String(code).trim();
  if (!value || value === '-' || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') {
    return null;
  }
  return value;
}

export function isValidCode(code: unknown): boolean {
  return normalizeCode(code) !== null;
}

let cachedRecords: ColorRecord[] | null = null;

export function getAllColorRecords(): ColorRecord[] {
  if (cachedRecords) return cachedRecords;

  cachedRecords = Object.entries(mapping)
    .map(([rawHex, rawCodes], index) => {
      const hex = normalizeHex(rawHex);
      return {
        hex,
        rgb: hexToRgb(hex),
        index,
        codes: {
          MARD: normalizeCode(rawCodes['9']),       // Mard 291
          COCO: normalizeCode(rawCodes['37']),      // CoCo 293
          漫漫: normalizeCode(rawCodes['38']),      // 漫漫 216
          盼盼: normalizeCode(rawCodes['47']),      // 盼盼 291
          咪小窝: normalizeCode(rawCodes['41']),    // 咪小窝 292
          KaKa: normalizeCode(rawCodes['42']),      // 卡卡 286
          优肯: normalizeCode(rawCodes['431']) || normalizeCode(rawCodes['43']) || normalizeCode(rawCodes['44']),  // 优肯
          黄豆豆: normalizeCode(rawCodes['16']),   // 黄豆豆 168
          DoDo: normalizeCode(rawCodes['27']),     // DoDo 290
          小舞: normalizeCode(rawCodes['39']),     // 小舞 290
          柿柿: normalizeCode(rawCodes['45']),     // 柿柿
          童趣: normalizeCode(rawCodes['46']),     // 童趣
        },
      } satisfies ColorRecord;
    })
    // 保持 JSON 顺序，确保 preset slice 稳定。
    .sort((a, b) => a.index - b.index);

  return cachedRecords;
}

/**
 * 获取当前品牌真实可用颜色。
 * 同一个品牌色号如果在源数据里重复，保留第一次出现的记录，避免 UI/后端重复色号。
 */
export function getBrandColors(brand: BrandType): ColorRecord[] {
  const seenCodes = new Set<string>();
  const colors: ColorRecord[] = [];

  for (const record of getAllColorRecords()) {
    const code = record.codes[brand];
    if (!code || seenCodes.has(code)) continue;
    seenCodes.add(code);
    colors.push(record);
  }

  return colors;
}

export function getBrandColorCount(brand: BrandType): number {
  return getBrandColors(brand).length;
}

export function getAllBrands(): BrandType[] {
  return [...BRANDS];
}

export function buildBrandColorMap(brand: BrandType): Map<string, ColorRecord> {
  return new Map(getBrandColors(brand).map((record) => [record.hex, record]));
}

export function normalizePresetId(presetId: unknown): PresetId {
  const id = String(presetId || 'all').trim();
  if (id === '291' || id === '221' || id === '144' || id === '120' || id === 'all') return id;
  return 'all';
}

export function getPresetColorLimit(presetId: string | null | undefined): number | null {
  const id = normalizePresetId(presetId);
  if (id === 'all') return null;
  return PRESET_LIMITS[id];
}

/**
 * 按当前品牌和预设获取颜色。
 * 业务规则：
 * - 只有 MARD 有 291 / 221 / 144 / 120 预设。
 * - 其他品牌没有任何预设，默认返回全部可用色。
 */
export function getBrandPresetColors(brand: BrandType, presetId: string | null | undefined): ColorRecord[] {
  const colors = getBrandColors(brand);

  if (brand !== 'MARD') return colors;

  const limit = getPresetColorLimit(presetId);
  if (!limit || colors.length <= limit) return colors;
  return colors.slice(0, limit);
}

export function getEffectivePresetId(brand: BrandType, presetId: string | null | undefined): PresetId {
  if (brand !== 'MARD') return 'all';
  const normalized = normalizePresetId(presetId || '221');
  return normalized === 'all' ? '221' : normalized;
}

export function getBrandPresets(brand: BrandType): PalettePreset[] {
  const totalCount = getBrandColorCount(brand);

  if (brand !== 'MARD') {
    return [
      {
        id: 'all',
        name: '全部可用色',
        description: `${brand} 无预设，默认使用全部可用色`,
        brand,
        colorCount: totalCount,
      },
    ];
  }

  const makePreset = (id: Exclude<PresetId, 'all'>, name: string, description: string): PalettePreset => ({
    id,
    name,
    description,
    brand,
    colorCount: Math.min(PRESET_LIMITS[id], totalCount),
  });

  return [
    makePreset('291', '291色', 'MARD 完整标准色系'),
    makePreset('221', '221色', 'MARD 常用经典色系'),
    makePreset('144', '144色', 'MARD 精简常用色系'),
    makePreset('120', '120色', 'MARD 入门简化色系'),
  ];
}

export function buildAllowedPalette(
  brand: BrandType,
  presetId: string | null | undefined,
  selectedColorCodes: string[] = []
): AllowedPaletteItem[] {
  // 1. 优先通过精确预设ID查找 (例如: 'Mard_291', 'COCO_350')
  let targetBrand = newColorData.brands.find((b: any) => b.brandCode === presetId);
  
  // 2. 如果没找到，尝试按品牌名称查找其最大预设
  if (!targetBrand) {
    const groupMap: Record<string, string> = {
      'MARD': 'Mard', 'COCO': 'CoCo', 'KaKa': '卡卡', '卡卡': '卡卡',
      '漫漫': '漫漫', '盼盼': '盼盼', '咪小窝': '咪小窝'
    };
    const searchName = groupMap[brand as string] || brand;
    
    const brandPresets = newColorData.brands.filter((b: any) => 
      b.groupName === searchName || (b.brandName && b.brandName.includes(searchName))
    );
    
    if (brandPresets.length > 0) {
      // 取颜色数量最多的预设兜底
      brandPresets.sort((a: any, b: any) => {
        const aCount = newColorData.colorCards[a.id.toString()]?.length || 0;
        const bCount = newColorData.colorCards[b.id.toString()]?.length || 0;
        return bCount - aCount;
      });
      targetBrand = brandPresets[0];
    }
  }

  // 3. 终极兜底方案
  if (!targetBrand) {
    console.warn(`[ColorSystem] 警告：未找到品牌 ${brand} 或预设 ${presetId} 的颜色，使用 MARD 兜底`);
    targetBrand = newColorData.brands.find((b: any) => b.brandCode === 'Mard_291');
  }

  if (!targetBrand) return [];

  // 获取该预设下的所有颜色并去重
  const colors = newColorData.colorCards[targetBrand.id.toString()] || [];
  const palette: AllowedPaletteItem[] = [];
  const seen = new Set<string>();

  colors.forEach((c: any) => {
    const code = c.colorCode || c.id;
    if (!seen.has(code)) {
      seen.add(code);
      const r = parseInt(c.color.slice(1, 3), 16) || 0;
      const g = parseInt(c.color.slice(3, 5), 16) || 0;
      const b = parseInt(c.color.slice(5, 7), 16) || 0;
      palette.push({
        masterCode: code,
        displayCode: code,
        brand: brand,
        hex: c.color.toUpperCase(),
        rgb: [r, g, b],
      });
    }
  });

  return palette;
}

// -----------------------------
// Color distance helpers
// -----------------------------

function srgbToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** OKLab 更接近人眼感知，比 RGB 欧氏距离更不容易把肤色/灰白映射到奇怪深色。 */
function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

export function colorDistanceRGB(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

export function findNearestColor(
  r: number,
  g: number,
  b: number,
  allowedColors: AllowedPaletteItem[]
): AllowedPaletteItem {
  let nearest = allowedColors[0];
  let minDist = Infinity;

  for (const c of allowedColors) {
    const dist = colorDistanceRGB(r, g, b, c.rgb[0], c.rgb[1], c.rgb[2]);
    if (dist < minDist) {
      minDist = dist;
      nearest = c;
    }
  }

  return nearest;
}

export function findNearestColorOklab(
  r: number,
  g: number,
  b: number,
  allowedColors: AllowedPaletteItem[]
): AllowedPaletteItem {
  const [labL, labA, labB] = rgbToOklab(r, g, b);
  let nearest = allowedColors[0];
  let minDist = Infinity;

  for (const c of allowedColors) {
    const [cL, cA, cB] = rgbToOklab(c.rgb[0], c.rgb[1], c.rgb[2]);
    const dist = Math.sqrt(
      Math.pow(labL - cL, 2) +
      Math.pow(labA - cA, 2) +
      Math.pow(labB - cB, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = c;
    }
  }

  return nearest;
}
