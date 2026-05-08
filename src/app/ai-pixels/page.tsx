'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import AIPaletteCenter from '@/components/AIPaletteCenter';
import PixelCanvas from '@/components/PixelCanvas';
import colorSystemMapping from '@/data/colorSystemMapping.json';
import newColorData from '@/data/ai-newColorData.json';
import HistoryDrawer, { type HistoryItem } from '@/components/HistoryDrawer';
import HistoryDetailModal from '@/components/HistoryDetailModal';
import { db } from '@/lib/db';

// 动态获取每个品牌数量最多的预设
const getDefaultPresetForBrand = (brandName: string): string => {
  const brandPresets = newColorData.brands.filter((b: any) => b.groupName === brandName);
  if (brandPresets.length === 0) return '';
  // 按颜色数量排序，返回最多的
  brandPresets.sort((a: any, b: any) => {
    const aCount = newColorData.colorCards[a.id]?.length || 0;
    const bCount = newColorData.colorCards[b.id]?.length || 0;
    return bCount - aCount;
  });
  return brandPresets[0].brandCode;
};

// 品牌默认预设映射
const BRAND_DEFAULTS: Record<string, string> = {
  'MARD': 'Mard_291',
  'COCO': 'CoCo_291',
  '漫漫': '漫漫_289',
  '盼盼': '盼盼_287',
  '咪小窝': '咪小窝_291',
  '黄豆豆': '黄豆豆_168',
  'DoDo': 'DoDo_290',
  '小舞': '小舞_290',
  '卡卡': '卡卡_286',
  '优肯': '优肯_418',
  '柿柿': '柿柿_217',
  '童趣': '童趣_120',
};
import {
  calculateOptimizeTargetSize,
  normalizeMaxSide,
} from '@/lib/pattern-size';
import { useAITimes } from '@/hooks/useAITimes';
import AITimesActivationModal from '@/components/AITimesActivationModal';

// ============================================
// 类型定义
// ============================================
type BrandType = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝' | 'KaKa' | '卡卡' | '优肯' | '黄豆豆' | 'DoDo' | '小舞' | '柿柿' | '童趣';
type ColorMapping = Record<string, Partial<Record<BrandType | string, string>>>;
type PresetType = 'all' | '291' | '221' | '144' | '120';
type EditorTool = 'brush' | 'eraser';
type PixelCell = {
  rgb?: { r: number; g: number; b: number };
  code?: string;
  hex?: string;
  r?: number;
  g?: number;
  b?: number;
  transparent?: boolean;
  [key: string]: unknown;
};
type PixelMatrix = PixelCell[][];
type EditorColor = {
  code: string;
  label: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
};
// 品牌名到 Brand ID 的映射
const BRAND_NAME_TO_ID: Record<string, string> = {
  'MARD': '9',
  'Mard': '9',
  'COCO': '37',
  'CoCo': '37',
  '漫漫': '38',
  '盼盼': '47',
  '咪小窝': '41',
  'KaKa': '42',
  '卡卡': '42',
  '优肯': '431',
  '黄豆豆': '16',
  'DoDo': '27',
  '小舞': '39',
  '柿柿': '45',
  '童趣': '46',
};
const PRESET_LIMITS: Record<Exclude<PresetType, 'all'>, number> = {
  '291': 291, '221': 221, '144': 144, '120': 120,
};
function normalizePaletteId(value?: string | null): PresetType {
  if (value === 'all' || value === '291' || value === '221' || value === '144' || value === '120') return value;
  return '291';
}
function getEffectivePaletteId(brand: BrandType, value?: string | null): PresetType {
  if (brand !== 'MARD') return 'all';
  const normalized = normalizePaletteId(value);
  return normalized === 'all' ? '291' : normalized;
}
function countAvailableColors(colorMapping: ColorMapping, brand: BrandType, presetId: string | null): number {
  // 🚨 修复：当 colorMapping 为空时，根据品牌从 newColorData 获取最大预设数量
  if (!colorMapping || Object.keys(colorMapping).length === 0) {
    // 非MARD品牌：从 newColorData 获取该品牌的最大预设数量
    // 注意：brand可能是'MARD'或'Mard'，需要找到匹配的groupName
    const brandLower = brand.toLowerCase();
    console.log(`[countAvailableColors] brand=${brand}, brandLower=${brandLower}`);
    const brandPresets = newColorData?.brands?.filter((b: { groupName: string }) => {
      const match = b.groupName.toLowerCase() === brandLower;
      console.log(`[countAvailableColors] checking b.groupName=${b.groupName}, match=${match}`);
      return match;
    }) || [];
    console.log(`[countAvailableColors] brandPresets.length=${brandPresets.length}`);
    if (brandPresets.length > 0) {
      // 优先使用 colorCount 字段，否则从 brandCode 提取数字，最后从 colorCards 获取
      let maxCount = 0;
      let maxPreset = brandPresets[0];
      brandPresets.forEach((b: { brandCode: string; colorCount?: number; id: number }) => {
        // 优先使用 colorCount
        const count = b.colorCount || 0;
        if (count > maxCount) {
          maxCount = count;
          maxPreset = b;
        }
        // 如果没有 colorCount，尝试从 brandCode 提取数字
        if (maxCount === 0) {
          const match = b.brandCode.match(/-(\d+)$/);
          if (match) {
            maxCount = parseInt(match[1]);
            if (maxCount > 0) maxPreset = b;
          }
        }
        // 最后，从 colorCards 直接获取数量
        const actualCount = newColorData?.colorCards?.[String(b.id)]?.length || 0;
        if (actualCount > maxCount) {
          maxCount = actualCount;
          maxPreset = b;
        }
      });
      return maxCount > 0 ? maxCount : 24; // 默认返回24
    }
    // MARD 品牌
    if (brandLower === 'mard') {
      return 291;
    }
    return 0;
  }
  // 非MARD品牌：优先使用 newColorData 获取最大预设的实际颜色数量
  if (brand !== 'MARD') {
    const brandLower = brand.toLowerCase();
    const brandPresets = newColorData?.brands?.filter((b: { groupName: string }) => b.groupName.toLowerCase() === brandLower) || [];
    if (brandPresets.length > 0) {
      // 找最大预设的颜色数量（优先使用 colorCards 的实际数量）
      let maxCount = 0;
      brandPresets.forEach((b: { brandCode: string; colorCount?: number; id: number }) => {
        // 从 colorCards 获取实际数量
        const actualCount = newColorData?.colorCards?.[String(b.id)]?.length || 0;
        if (actualCount > maxCount) {
          maxCount = actualCount;
        }
        // 如果 colorCards 没有数据，尝试从 colorCount 字段获取
        if (maxCount === 0 && b.colorCount && b.colorCount > maxCount) {
          maxCount = b.colorCount;
        }
        // 最后从 brandCode 提取数字
        if (maxCount === 0) {
          const match = b.brandCode.match(/_(\d+)$|[-](\d+)$/);
          if (match) {
            // 匹配 _数字 格式在 match[1]，匹配 -数字 格式在 match[2]
            const count = parseInt(match[1] || match[2] || '0');
            if (count > maxCount) {
              maxCount = count;
            }
          }
        }
      });
      if (maxCount > 0) return maxCount;
    }
  }
  
  // 非MARD品牌：从 colorMapping 统计有该品牌色号的 HEX 数量
  // 注意：colorMapping 的 inner key 是 Brand ID（如 '45', '46'），不是品牌名
  const brandId = BRAND_NAME_TO_ID[brand] || brand;
  const seen = new Set<string>();
  for (const codes of Object.values(colorMapping)) {
    // 优先用 Brand ID 查找，其次用品牌名
    const code = codes?.[brandId]?.trim() || codes?.[brand]?.trim();
    if (code && code !== '-' && code.toLowerCase() !== 'null') seen.add(code);
  }
  const total = seen.size;
  if (total > 0) return total;
  
  // 如果 colorMapping 中没找到，回退到 newColorData
  const brandLower = brand.toLowerCase();
  const brandPresets = newColorData?.brands?.filter((b: { groupName: string }) => b.groupName.toLowerCase() === brandLower) || [];
  if (brandPresets.length > 0) {
    let maxCount = 0;
    brandPresets.forEach((b: { id: number }) => {
      const actualCount = newColorData?.colorCards?.[String(b.id)]?.length || 0;
      if (actualCount > maxCount) maxCount = actualCount;
    });
    return maxCount || 24;
  }
  
  // MARD 默认值
  if (brandLower === 'mard' || brandLower === 'mard_291') return 291;
  return 24;
}
interface OptimizeResult {
  success: boolean;
  outputImageUrl: string;
  debug?: Record<string, unknown>;
}
interface PatternResult {
  success: boolean;
  previewUrl: string;
  actualWidth: number;
  actualHeight: number;
  totalBeads: number;
  colorCount: number;
  stats: Array<{
    masterCode: string;
    displayCode: string;
    hex: string;
    rgb: [number, number, number];
    count: number;
  }>;
  pixelMatrix?: PixelMatrix;
}
const AI_MODES = [
  { id: 'pixelFullBody', name: '像素全身', desc: '按比例计算图纸，完整造型', image: '/reference/pixel-fullbody-style.png' },
  { id: 'pixelPortrait', name: '精致像素图', desc: 'Q版单人，大头小身，适合正方形图纸', image: '/reference/pixel-portrait-style.png' },
  { id: 'pixelDoll', name: 'Q版像素大头', desc: 'Q版豆灵风格，适合正方形图纸', image: '/reference/pixel-doll-style.png' },
  { id: 'cartoon', name: '动漫像素图', desc: '正方形 52x52，极简大色块', image: '/reference/pixel-cartoon-style.png' },
  { id: 'cutePet', name: '可爱萌宠风', desc: '正方形 52x52，极简大色块', image: '/reference/pixel-cutepet-style.png' },
  { id: 'carStyle', name: '汽车专用风', desc: '正方形 52x52，极简大色块', image: '/reference/pixel-car-style.png' }
];
const BRANDS: BrandType[] = ['Mard', '黄豆豆', 'DoDo', 'CoCo', '漫漫', '小舞', '咪小窝', '卡卡', '优肯', '柿柿', '童趣', '盼盼'];
// 预设列表（隐藏MARD相关预设）
const PRESETS = [];
const PALETTE_REQUIRED_MODES = ['pixelPortrait'];

// ============================================
// 工具函数
// ============================================
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
// 格式化预设名称用于显示（支持 _数字 和 -数字 格式）
function formatPresetName(preset: string): string {
  // 匹配 _数字 或 -数字 格式
  const match = preset.match(/^(.+)[_-](\d+)$/);
  if (match) {
    const brand = match[1];
    const count = match[2];
    // 转换品牌名称格式
    const displayBrand = brand === 'Mard' ? 'MARD' : brand;
    return `${displayBrand} ${count} 色`;
  }
  return preset;
}
function downloadImage(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadImage(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
function clampColorValue(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.min(255, Math.round(numberValue)));
}
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((v) => clampColorValue(v).toString(16).padStart(2, '0')).join('')}`;
}
function hexToRgb(hex?: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
function getCellRgb(cell?: PixelCell | null): { r: number; g: number; b: number } {
  if (!cell) return { r: 255, g: 255, b: 255 };
  if (cell.rgb) return {
    r: clampColorValue(cell.rgb.r),
    g: clampColorValue(cell.rgb.g),
    b: clampColorValue(cell.rgb.b),
  };
  if (cell.r !== undefined || cell.g !== undefined || cell.b !== undefined) {
    return {
      r: clampColorValue(cell.r),
      g: clampColorValue(cell.g),
      b: clampColorValue(cell.b),
    };
  }
  const hexRgb = hexToRgb(typeof cell.hex === 'string' ? cell.hex : null);
  return hexRgb || { r: 255, g: 255, b: 255 };
}
function isTransparentCell(cell?: PixelCell | null): boolean {
  if (!cell) return true;
  return cell.transparent === true || cell.code === 'transparent' || cell.code === '透明';
}
function cloneMatrix(matrix: PixelMatrix): PixelMatrix {
  return matrix.map((row) => row.map((cell) => ({
    ...cell,
    rgb: cell?.rgb ? { ...cell.rgb } : undefined,
  })));
}
function makeTransparentCell(): PixelCell {
  return {
    code: 'transparent',
    rgb: { r: 255, g: 255, b: 255 },
    hex: '#ffffff',
    transparent: true,
  };
}
function makeBrushCell(color: EditorColor): PixelCell {
  // 处理 rgb 可能缺失的情况，从 hex 转换
  let rgb: { r: number; g: number; b: number };
  if (color.rgb) {
    rgb = { ...color.rgb };
  } else if (color.hex) {
    // 从 hex 转换
    const hex = color.hex.replace('#', '');
    rgb = {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  } else {
    rgb = { r: 0, g: 0, b: 0 };
  }
  return {
    code: color.code,
    displayCode: color.code,
    masterCode: color.code,
    rgb,
    hex: color.hex,
    transparent: false,
  };
}
function getColorCountFromBrandRecord(record: any): number {
  if (!record) return 0;
  const cards = (newColorData as any)?.colorCards?.[String(record.id)] || [];
  return cards.length || record.colorCount || 0;
}
function buildEditorPalette(
  brand: BrandType,
  preset: string,
  generationSelectedColors: Record<string, [number, number, number]> = {},
): EditorColor[] {
  const customEntries = Object.entries(generationSelectedColors || {});
  if (customEntries.length > 0) {
    return customEntries.map(([code, rgb]) => {
      const color = { r: clampColorValue(rgb?.[0]), g: clampColorValue(rgb?.[1]), b: clampColorValue(rgb?.[2]) };
      return { code, label: code, rgb: color, hex: rgbToHex(color) };
    });
  }
  const brands = (newColorData as any)?.brands || [];
  const cardsMap = (newColorData as any)?.colorCards || {};
  const brandName = String(brand || '').toLowerCase();
  const exactPreset = brands.find((item: any) => item?.brandCode === preset);
  const brandPresets = brands
    .filter((item: any) => String(item?.groupName || '').toLowerCase() === brandName)
    .sort((a: any, b: any) => getColorCountFromBrandRecord(b) - getColorCountFromBrandRecord(a));
  const targetPreset = exactPreset || brandPresets[0];
  const cards = cardsMap[String(targetPreset?.id)] || [];
  return cards
    .map((card: any, index: number) => {
      const rawCode = card?.code ?? card?.displayCode ?? card?.colorCode ?? card?.colorNo ?? card?.cardNo ?? card?.name ?? card?.label ?? card?.id ?? `${index + 1}`;
      const code = String(rawCode);
      const rawHex = card?.hex ?? card?.colorHex ?? card?.hexCode ?? card?.value ?? card?.rgbHex ?? '';
      const rgbFromArray = Array.isArray(card?.rgb)
        ? { r: clampColorValue(card.rgb[0]), g: clampColorValue(card.rgb[1]), b: clampColorValue(card.rgb[2]) }
        : null;
      const rgbFromObject = card?.rgb && typeof card.rgb === 'object' && !Array.isArray(card.rgb)
        ? { r: clampColorValue(card.rgb.r), g: clampColorValue(card.rgb.g), b: clampColorValue(card.rgb.b) }
        : null;
      const rgbFromFields = (card?.r !== undefined || card?.g !== undefined || card?.b !== undefined)
        ? { r: clampColorValue(card.r), g: clampColorValue(card.g), b: clampColorValue(card.b) }
        : null;
      const rgb = rgbFromArray || rgbFromObject || rgbFromFields || hexToRgb(String(rawHex));
      if (!rgb) return null;
      return {
        code,
        label: String(card?.colorName ?? card?.name ?? code),
        rgb,
        hex: String(rawHex || rgbToHex(rgb)).startsWith('#') ? String(rawHex || rgbToHex(rgb)) : `#${rawHex || rgbToHex(rgb).replace('#', '')}`,
      };
    })
    .filter(Boolean) as EditorColor[];
}
function countMatrixBeads(matrix?: PixelMatrix | null): number {
  if (!matrix) return 0;
  return matrix.reduce((total, row) => total + row.filter((cell) => !isTransparentCell(cell) && cell?.code && cell.code !== '未知').length, 0);
}

// ============================================
// 组件
// ============================================
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn(
      'rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_80px_-42px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-5 md:p-6',
      className,
    )}>
      {children}
    </section>
  );
}
function SectionHeader({ icon, title, desc, action, step }: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  step?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15 sm:h-12 sm:w-12">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            {step ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{step}</span> : null}
            <h2 className="truncate text-base font-black tracking-tight text-slate-950 sm:text-lg">{title}</h2>
          </div>
          {desc ? <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 sm:text-sm">{desc}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
function MetricCard({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'violet' | 'emerald' | 'amber' }) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-950 ring-slate-200',
    violet: 'bg-violet-50 text-violet-950 ring-violet-100',
    emerald: 'bg-emerald-50 text-emerald-950 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-950 ring-amber-100',
  }[tone];
  return (
    <div className={cn('rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 ring-1', toneClass)}>
      <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] opacity-55">{label}</span>
      <p className="mt-0.5 sm:mt-1 text-sm sm:text-base font-black">{value}</p>
    </div>
  );
}
function IconImage() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}
function IconSize() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
// ============================================
// 编辑器组件 - 带缩放拖拽
// ============================================
function PatternEditorPanel({
  matrix,
  setMatrix,
  palette,
  patternStats,
  tool,
  setTool,
  brushColor,
  setBrushColor,
  isDraggingMode,
  setIsDraggingMode,
  onMirror,
  onDownload,
}: {
  matrix: PixelMatrix;
  setMatrix: React.Dispatch<React.SetStateAction<PixelMatrix | null>>;
  palette: EditorColor[];
  patternStats: Array<{masterCode: string; displayCode: string; hex: string; rgb: [number, number, number]; count: number}>;
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  brushColor: EditorColor | null;
  setBrushColor: (color: EditorColor) => void;
  isDraggingMode: boolean;
  setIsDraggingMode: (value: boolean) => void;
  onMirror: () => void;
  onDownload: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPaintingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTouchDistRef = useRef<number>(0);
  const lastTouchCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false); // 固定画布状态
  const [brushSearch, setBrushSearch] = useState(''); // 画笔颜色搜索
  const [isCanvasDragging, setIsCanvasDragging] = useState(false); // 画布拖拽状态
  const [colorSearch, setColorSearch] = useState(''); // 补充漏掉的用料统计搜索状态
  const [replaceSearch, setReplaceSearch] = useState(''); // 替换弹窗的搜索状态
  const [replaceSource, setReplaceSource] = useState<string | null>(null); // 替换源颜色
  const [replaceTarget, setReplaceTarget] = useState<EditorColor | null>(null); // 替换目标颜色
  
  // 双指缩放手势处理
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const touches = e.touches;
    if (touches.length === 2) {
      // 双指缩放
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
    } else if (touches.length === 1 && isDraggingMode) {
      // 单指拖拽模式
      isDraggingRef.current = true;
      lastPosRef.current = { x: touches[0].clientX, y: touches[0].clientY };
    }
  }, [isLocked, isDraggingMode]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const touches = e.touches;
    if (touches.length === 2) {
      // 双指缩放
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (lastTouchDistRef.current > 0) {
        const scaleFactor = dist / lastTouchDistRef.current;
        setScale(prev => Math.max(0.3, Math.min(3, prev * scaleFactor)));
      }
      
      lastTouchDistRef.current = dist;
      
      // 双指平移
      const center = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
      const dxCenter = center.x - lastTouchCenterRef.current.x;
      const dyCenter = center.y - lastTouchCenterRef.current.y;
      setOffset(prev => ({ x: prev.x + dxCenter, y: prev.y + dyCenter }));
      lastTouchCenterRef.current = center;
    } else if (touches.length === 1 && isDraggingRef.current && isDraggingMode) {
      // 单指拖拽
      const touch = touches[0];
      const dx = touch.clientX - lastPosRef.current.x;
      const dy = touch.clientY - lastPosRef.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [isLocked, isDraggingMode]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchDistRef.current = 0;
    if (e.touches.length === 0) {
      isDraggingRef.current = false;
    }
  }, []);
  
  // 强行拦截浏览器原生滚轮事件，实现只缩放画布不滚页面
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (isLocked) return;
      e.preventDefault(); // 绝对阻止页面滚动
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.max(0.3, Math.min(3, prev * delta)));
    };

    // { passive: false } 是让 preventDefault 生效的命门！
    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelNative);
  }, [isLocked]);
  
  // 🚨 实时扫描画布矩阵，提取图纸中真正用到的颜色并统计数量
  const usedColorStats = useMemo(() => {
    if (!matrix || !Array.isArray(matrix) || matrix.length === 0) {
      console.log('[DEBUG] matrix 为空:', matrix);
      return [];
    }
    const counts = new Map();
    matrix.forEach((row: any[], rowIndex: number) => {
      if (!row) return;
      row.forEach((cell: any, colIndex: number) => {
        // 支持多种颜色属性格式
        // Python 返回格式: { rgb: {r, g, b}, code: 'A01' }
        // 前端格式: { hex: '#FF0000', code: 'A01' }
        let cellHex = cell?.hex || cell?.color;
        const cellRgb = cell?.rgb;
        const cellCode = cell?.code || cell?.key || cell?.displayCode;
        
        // 如果没有 hex，从 rgb 对象转换
        if (!cellHex && cellRgb) {
          const r = cellRgb.r?.toString(16).padStart(2, '0') || '00';
          const g = cellRgb.g?.toString(16).padStart(2, '0') || '00';
          const b = cellRgb.b?.toString(16).padStart(2, '0') || '00';
          cellHex = `#${r}${g}${b}`.toUpperCase();
        }
        
        // 跳过空白、transparent、null
        if (!cell || cellCode === 'transparent' || cellHex === 'transparent' || cellCode === 'null') return;
        if (!cellHex) return;
        if (!cellCode) return;
        
        const code = String(cellCode);
        if (!counts.has(code)) {
          counts.set(code, { code, hex: String(cellHex), count: 0 });
        }
        counts.get(code).count++;
      });
    });
    console.log('[DEBUG] usedColorStats 计算完成:', Array.from(counts.values()).length, '种颜色');
    // 按使用数量从大到小排序
    return Array.from(counts.values()).sort((a: any, b: any) => b.count - a.count);
  }, [matrix]);
  
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  
  // 基于 patternStats 构建色号映射表
  const codeToColorMap = useMemo(() => {
    const map: Record<string, EditorColor> = {};
    patternStats.forEach(stat => {
      const code = stat.displayCode || stat.masterCode;
      if (code) {
        map[code] = {
          code,
          label: code,
          hex: stat.hex,
          rgb: { r: stat.rgb[0], g: stat.rgb[1], b: stat.rgb[2] }
        };
      }
    });
    // 也添加 palette 中的颜色
    palette.forEach(p => {
      if (!map[p.code]) {
        map[p.code] = p;
      }
    });
    return map;
  }, [patternStats, palette]);
  
  // 当前调色板 = patternStats 的颜色
  // 使用传入的 palette（来自选中品牌的全部色号），而非重新计算
  const editorPalette = palette;
  
  const baseCellSize = useMemo(() => {
    const maxSide = Math.max(rows, cols);
    if (maxSide >= 120) return 8;
    if (maxSide >= 90) return 10;
    if (maxSide >= 65) return 12;
    return 14;
  }, [rows, cols]);
  
  const editedBeads = useMemo(() => countMatrixBeads(matrix), [matrix]);
  
  const drawEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows || !cols) return;
    
    // 计算实际显示的 cellSize（用于绘制）
    const displayCellSize = baseCellSize * scale;
    
    // canvas 尺寸跟随缩放，这样文字才不会模糊
    canvas.width = cols * displayCellSize;
    canvas.height = rows * displayCellSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (isTransparentCell(cell)) return;
        const rgb = getCellRgb(cell);
        const cx = x * displayCellSize;
        const cy = y * displayCellSize;
        
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.fillRect(cx, cy, displayCellSize, displayCellSize);
      });
    });
    
    // 绘制网格线
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) {
      ctx.moveTo(x * displayCellSize + 0.5, 0);
      ctx.lineTo(x * displayCellSize + 0.5, rows * displayCellSize);
    }
    for (let y = 0; y <= rows; y++) {
      ctx.moveTo(0, y * displayCellSize + 0.5);
      ctx.lineTo(cols * displayCellSize, y * displayCellSize + 0.5);
    }
    ctx.lineWidth = scale >= 1 ? 1 : 0.5;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    
    // 每5格加粗线
    ctx.beginPath();
    for (let x = 0; x <= cols; x += 5) {
      ctx.moveTo(x * displayCellSize + 0.5, 0);
      ctx.lineTo(x * displayCellSize + 0.5, rows * displayCellSize);
    }
    for (let y = 0; y <= rows; y += 5) {
      ctx.moveTo(0, y * displayCellSize + 0.5);
      ctx.lineTo(cols * displayCellSize, y * displayCellSize + 0.5);
    }
    ctx.lineWidth = scale >= 1 ? 1.5 : 0.75;
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
    
    // 绘制色号文字 (当格子足够大时)
    if (displayCellSize >= 12) {
      matrix.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (isTransparentCell(cell) || !cell.code) return;
          const rgb = getCellRgb(cell);
          const cx = x * displayCellSize;
          const cy = y * displayCellSize;
          
          // 根据颜色深浅决定文字颜色
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
          
          // 文字大小基于实际显示的 cellSize
          const fontSize = Math.max(8, Math.min(displayCellSize * 0.4, 12));
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // 简化色号显示
          const shortCode = String(cell.code).slice(-4);
          ctx.fillText(shortCode, cx + displayCellSize / 2, cy + displayCellSize / 2);
        });
      });
    }
  }, [matrix, rows, cols, baseCellSize, scale]);
  
  useEffect(() => {
    drawEditorCanvas();
  }, [drawEditorCanvas]);
  
  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (isLocked) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(3, scale * delta));
    setScale(newScale);
  }, [scale, isLocked]);
  
  // 拖拽画布
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) return;
    // 如果是拖拽模式，不触发绘制
    if (isDraggingMode) return;
    if (e.button === 0) { // 左键
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [isLocked, isDraggingMode]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);
  
  // 绘制
  const paintAt = useCallback((clientX: number, clientY: number) => {
    // 如果是拖拽模式，不执行绘制
    if (isDraggingMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !rows || !cols) return;
    if (tool === 'brush' && !brushColor) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // 计算相对于 canvas 原点的位置，考虑偏移
    const relativeX = (clientX - rect.left) * scaleX;
    const relativeY = (clientY - rect.top) * scaleY;
    
    // 使用 displayCellSize 计算格子坐标
    const displayCellSize = baseCellSize * scale;
    const x = Math.floor(relativeX / displayCellSize);
    const y = Math.floor(relativeY / displayCellSize);
    
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    
    // 处理颜色替换模式
    if (replaceSource && replaceTarget) {
      const sourceCode = replaceSource;
      setMatrix((prev) => {
        if (!prev) return prev;
        const next = cloneMatrix(prev);
        for (let rowIdx = 0; rowIdx < next.length; rowIdx++) {
          for (let colIdx = 0; colIdx < next[rowIdx].length; colIdx++) {
            const cell = next[rowIdx][colIdx];
            const cellCode = cell?.code || '';
            if (cellCode === sourceCode || cellCode === sourceCode.toUpperCase() || cellCode === sourceCode.toLowerCase()) {
              next[rowIdx][colIdx] = makeBrushCell(replaceTarget);
            }
          }
        }
        return next;
      });
      return;
    }
    
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = cloneMatrix(prev);
      next[y][x] = tool === 'eraser' ? makeTransparentCell() : makeBrushCell(brushColor as EditorColor);
      return next;
    });
  }, [brushColor, baseCellSize, scale, cols, rows, setMatrix, tool, replaceSource, replaceTarget]);
  
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    // 如果是拖拽模式，执行画布拖拽而不是绘制
    if (isDraggingMode && !isLocked) {
      isDraggingRef.current = true;
      lastPosRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    isPaintingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintAt(event.clientX, event.clientY);
  }, [paintAt, isDraggingMode, isLocked]);
  
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    // 如果是拖拽模式，执行画布移动
    if (isDraggingRef.current && isDraggingMode) {
      const dx = event.clientX - lastPosRef.current.x;
      const dy = event.clientY - lastPosRef.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPosRef.current = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!isPaintingRef.current) return;
    paintAt(event.clientX, event.clientY);
  }, [paintAt, isDraggingMode]);
  
  const stopPainting = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    isPaintingRef.current = false;
    isDraggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  }, []);
  
  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    isPaintingRef.current = false;
    isDraggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  }, []);
  
  const handleZoomIn = () => setScale(s => Math.min(3, s * 1.2));
  const handleZoomOut = () => setScale(s => Math.max(0.3, s / 1.2));
  const handleResetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  
  return (
    <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3 shadow-inner sm:p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">导入修改</p>
          <h4 className="mt-1 text-base font-black text-slate-950">拼豆图片编辑画布</h4>
          <p className="mt-1 text-[10px] sm:text-xs font-semibold text-slate-500">滚轮/双指缩放，拖拽移动，画笔橡皮涂抹</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200">
            当前豆子数：{editedBeads.toLocaleString()}颗
          </div>
          <button onClick={handleZoomOut} className="rounded-xl bg-white p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          </button>
          <span className="text-xs font-bold text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={handleZoomIn} className="rounded-xl bg-white p-2 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={handleResetView} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">
            重置
          </button>
        </div>
      </div>
      
      {/* 画布容器 - 可缩放拖拽 */}
      <div 
        ref={containerRef}
        className="mb-4 h-[280px] sm:h-[400px] md:h-[520px] w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-inner flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isLocked ? 'not-allowed' : (isDraggingRef.current ? 'grabbing' : 'grab') }}
      >
        <div 
          style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 0.1s'
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopPainting}
            onPointerCancel={stopPainting}
            onPointerLeave={stopPainting}
            className="block cursor-crosshair rounded-xl shadow-sm ring-1 ring-slate-200"
            style={{ 
              touchAction: 'none',
              imageRendering: 'pixelated'
            }}
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        <div className="rounded-[1.25rem] bg-white p-3 ring-1 ring-slate-200">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">工具</p>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setTool('brush');
                setIsDraggingMode(false);
              }}
              className={cn(
                'rounded-2xl px-2 py-3 text-xs font-black transition-all',
                tool === 'brush' && !isDraggingMode ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              画笔
            </button>
            <button
              type="button"
              onClick={() => {
                setTool('eraser');
                setIsDraggingMode(false);
              }}
              className={cn(
                'rounded-2xl px-2 py-3 text-xs font-black transition-all',
                tool === 'eraser' && !isDraggingMode ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              橡皮擦
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDraggingMode(!isDraggingMode);
              }}
              disabled={isLocked}
              className={cn(
                'rounded-2xl px-2 py-3 text-xs font-black transition-all',
                isDraggingMode ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                isLocked && 'opacity-50 cursor-not-allowed'
              )}
            >
              拖拽
            </button>
            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              className={cn(
                'rounded-2xl px-2 py-3 text-xs font-black transition-all',
                isLocked ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              固定画布
            </button>
          </div>
        </div>
        {/* 画笔颜色区域 - 带有搜索框 */}
        <div className="rounded-[1.25rem] bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">画笔颜色</p>
              {brushColor ? (
                <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  <span className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: brushColor.hex }} />
                  {brushColor.code}
                </div>
              ) : null}
            </div>
            {/* 搜索框 */}
            <input
              type="text"
              placeholder="搜索色号..."
              value={brushSearch}
              onChange={(e) => setBrushSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
          {editorPalette.length > 0 ? (
            <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {editorPalette
                .filter((color) => 
                  !brushSearch || color.code.toLowerCase().includes(brushSearch.toLowerCase()) ||
                  color.label.toLowerCase().includes(brushSearch.toLowerCase())
                )
                .map((color) => {
                const active = brushColor?.code === color.code;
                return (
                  <button
                    key={`brush_${color.code}_${color.hex}`}
                    type="button"
                    onClick={() => {
                      setTool('brush');
                      setBrushColor(color);
                    }}
                    title={color.label}
                    className={cn(
                      'flex flex-col overflow-hidden rounded-xl border-2 bg-white text-[10px] font-black transition-all hover:-translate-y-0.5',
                      active ? 'border-[#ff4d6d] shadow-lg shadow-rose-500/10' : 'border-slate-100 hover:border-[#ff4d6d]/50',
                    )}
                  >
                    <span className="h-8 w-full" style={{ backgroundColor: color.hex }} />
                    <span className="truncate px-1 py-1 text-slate-700">{color.code}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              当前品牌没有读取到可用色号
            </div>
          )}
        </div>
        
        {/* 色号用料统计区域 - 带替换功能 */}
        <div className="rounded-[1.25rem] bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">色号用料统计</p>
            {replaceSource && (
              <button
                onClick={() => { setReplaceSource(null); setReplaceTarget(null); }}
                className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600 hover:bg-rose-200"
              >
                取消替换
              </button>
            )}
          </div>
          {/* 色号用料统计 - 仅显示图纸用色，采用大色块设计 */}
          {usedColorStats.length > 0 ? (
            <>
              <h4 className="text-sm font-bold text-slate-700 mb-3">
                色号用料统计 <span className="text-slate-400 text-xs font-normal">（图纸共使用 {usedColorStats.length} 色）</span>
              </h4>
              <div className="grid max-h-60 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 overflow-y-auto pr-2 pb-2">
                {usedColorStats
                  .filter(c => !colorSearch || c.code.toLowerCase().includes(colorSearch.toLowerCase()))
                  .map((stat) => {
                    const isActive = brushColor?.code === stat.code || brushColor?.key === stat.code;
                    return (
                      <div key={`stat_${stat.code}`} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            setTool('brush');
                            setBrushColor(stat);
                          }}
                          className={cn(
                            'flex w-full flex-col overflow-hidden rounded-xl border-2 text-[11px] font-black transition-all hover:-translate-y-1',
                            isActive ? 'border-rose-500 shadow-lg shadow-rose-500/20' : 'border-slate-100 hover:border-slate-300 shadow-sm'
                          )}
                        >
                          <div className="h-10 w-full relative" style={{ backgroundColor: stat.hex }}>
                             {/* 右上角替换小图标 */}
                             <div
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setReplaceSearch(''); // 打开弹窗时清空搜索
                                 setReplaceSource(stat.code);
                               }}
                               className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-600 opacity-0 shadow hover:bg-rose-500 hover:text-white group-hover:opacity-100 transition-all"
                               title="替换此颜色"
                             >
                               ⟳
                             </div>
                          </div>
                          <div className="w-full bg-white py-1.5 text-center text-slate-700 border-t border-slate-100">
                            {stat.code}
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
              {/* 漂亮的宽屏替换弹窗 */}
              {replaceSource && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                  <div className="flex w-full max-w-4xl flex-col max-h-[85vh] overflow-hidden rounded-[24px] bg-white shadow-2xl">
                    {/* 标题栏 */}
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                      <h3 className="text-lg font-black text-slate-800">颜色替换</h3>
                      <button
                        onClick={() => setReplaceSource(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {/* 提示信息 */}
                    <div className="bg-rose-50/50 px-6 py-3 border-b border-rose-100 flex items-center gap-2">
                       <span className="text-sm text-slate-600">将图纸中的</span>
                       <span className="rounded-md bg-white px-2 py-1 text-sm font-black text-rose-600 shadow-sm border border-rose-200">{replaceSource}</span>
                       <span className="text-sm text-slate-600">替换为以下颜色：</span>
                    </div>
                    
                    {/* 搜索框 */}
                    <div className="p-4 border-b border-slate-100 bg-white">
                      <input
                        type="text"
                        placeholder="搜索目标色号..."
                        value={replaceSearch}
                        onChange={(e) => setReplaceSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-rose-400 focus:bg-white focus:ring-4 focus:ring-rose-100"
                      />
                    </div>
                    
                    {/* 颜色选择大网格 */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
                      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                        {palette
                          .filter((color) => {
                            if (color.code === replaceSource) return false; // 排除自己
                            if (!replaceSearch) return true;
                            return color.code.toLowerCase().includes(replaceSearch.toLowerCase()) || 
                                   color.hex.toLowerCase().includes(replaceSearch.toLowerCase());
                          })
                          .map((color) => (
                            <button
                              key={`replace_modal_${color.code}_${color.hex}`}
                              onClick={() => {
                                // 调试日志
                                console.log('[替换] replaceSource:', replaceSource, '目标:', color.code);
                                setMatrix((prev) => {
                                  if (!prev) {
                                    console.log('[替换] prev 为空');
                                    return prev;
                                  }
                                  console.log('[替换] 开始替换, 矩阵尺寸:', prev.length, 'x', prev[0]?.length);
                                  const next = cloneMatrix(prev);
                                  let replacedCount = 0;
                                  for (let rowIdx = 0; rowIdx < next.length; rowIdx++) {
                                    for (let colIdx = 0; colIdx < next[rowIdx].length; colIdx++) {
                                      const cell = next[rowIdx][colIdx];
                                      const cellCode = cell?.code || cell?.key || '';
                                      // 不区分大小写比较
                                      if (cellCode.toLowerCase() === replaceSource?.toLowerCase()) {
                                        next[rowIdx][colIdx] = makeBrushCell(color);
                                        replacedCount++;
                                      }
                                    }
                                  }
                                  console.log('[替换] 替换了', replacedCount, '个格子');
                                  return next;
                                });
                                setReplaceSource(null);
                              }}
                              className="flex w-full flex-col overflow-hidden rounded-xl border-2 border-slate-200/80 bg-white text-[11px] font-black transition-all hover:-translate-y-1 hover:border-rose-400 hover:shadow-lg hover:shadow-rose-400/20"
                            >
                              <span className="h-10 w-full" style={{ backgroundColor: color.hex }} />
                              <span className="w-full truncate bg-white px-1 py-1.5 text-center text-slate-700 border-t border-slate-100">{color.code}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              暂无图纸用料统计
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================
export default function AIPixelsPage() {
  // AI次数管理
  const aiTimes = useAITimes();
  
  // 状态
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState('pixelPortrait');
  const [targetSize, setTargetSize] = useState(52);
  const [selectedBrand, setSelectedBrand] = useState<BrandType>('MARD');
  const [selectedPreset, setSelectedPreset] = useState<string>('Mard_291');
  const [colorMapping, setColorMapping] = useState<ColorMapping>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressInfo, setProgressInfo] = useState('');
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [patternResult, setPatternResult] = useState<PatternResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiImageSize, setAiImageSize] = useState({ width: 0, height: 0 });
  const [showPaletteCenter, setShowPaletteCenter] = useState(false);
  const [selectedColors, setSelectedColors] = useState<Record<string, [number, number, number]>>({});
  const [showAITimesModal, setShowAITimesModal] = useState(false);
  // 视图模式：'pixel' | 'grid' | 'pattern'
  const [viewMode, setViewMode] = useState<'pixel' | 'grid' | 'pattern'>('pattern');
  const [showEditor, setShowEditor] = useState(false);
  const [editableMatrix, setEditableMatrix] = useState<PixelMatrix | null>(null);
  const [editorTool, setEditorTool] = useState<EditorTool>('brush');
  const [brushColor, setBrushColor] = useState<EditorColor | null>(null);
  const [isDraggingMode, setIsDraggingMode] = useState(true); // 导入修改默认拖拽模式
  const [generatedBrand, setGeneratedBrand] = useState<BrandType>('MARD');
  const [generatedPreset, setGeneratedPreset] = useState<string>('Mard_291');
  const [generatedSelectedColors, setGeneratedSelectedColors] = useState<Record<string, [number, number, number]>>({});
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);
  const [showImportSuccessModal, setShowImportSuccessModal] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  
  // ========== 历史图纸功能 ==========
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyDetailItem, setHistoryDetailItem] = useState<HistoryItem | null>(null);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  
  // 从 IndexedDB 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await db.get('aiPerlerHistory');
        if (Array.isArray(saved)) {
          setHistoryList(saved);
        }
      } catch (e) {
        console.error('加载历史记录失败:', e);
      }
    };
    loadHistory();
  }, []);
  
  // 判断是否有内容（用于控制抽屉位置）
  const hasContent = !!(patternResult || editableMatrix);
  
  // 保存历史记录到 IndexedDB
  const saveHistoryList = useCallback(async (list: HistoryItem[]) => {
    try {
      await db.set('aiPerlerHistory', list);
      setHistoryList(list);
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
  }, []);
  
  // 添加新历史记录（最多20条）
  const addToHistory = useCallback((
    thumbnail: string,
    previewUrl: string,
    gridUrl: string,
    pureUrl: string,
    style: string,
    size: string,
    code: string,
    pixelMatrix?: any,
    colorStats?: Array<{ hex: string; displayCode: string; masterCode: string; count: number }>
  ) => {
    const timestamp = Date.now();
    const id = `ai_history_${timestamp}`;
    const newItem: HistoryItem = {
      id,
      name: `${style} ${code}`,
      timestamp,
      thumbnail,
      previewUrl,
      gridUrl,
      pureUrl,
      style,
      size,
      code,
      pixelMatrix,
      colorStats,
    };
    const updatedList = [newItem, ...historyList].slice(0, 20); // 最多保存20条
    saveHistoryList(updatedList);
    setHistoryDrawerOpen(true);
    return id; // 返回新记录的ID
  }, [historyList, saveHistoryList]);
  
  // 更新现有历史记录（用于导入修改后同步更新）
  const updateHistoryItem = useCallback((
    id: string,
    updates: Partial<HistoryItem>
  ) => {
    const updatedList = historyList.map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    saveHistoryList(updatedList);
  }, [historyList, saveHistoryList]);
  
  // 删除历史记录
  const deleteFromHistory = useCallback((id: string) => {
    const updatedList = historyList.filter(item => item.id !== id);
    saveHistoryList(updatedList);
  }, [historyList, saveHistoryList]);
  
  // 打开历史详情
  const openHistoryDetail = useCallback((item: HistoryItem) => {
    setHistoryDetailItem(item);
    setShowHistoryDetail(true);
  }, []);
  
  // 关闭历史详情
  const closeHistoryDetail = useCallback(() => {
    setShowHistoryDetail(false);
    setHistoryDetailItem(null);
  }, []);
  
  // 处理历史图纸的导入（恢复到编辑器）
  const handleRestoreFromHistory = useCallback((item: HistoryItem) => {
    if (item.pixelMatrix) {
      setEditableMatrix(item.pixelMatrix);
      setShowEditor(true);
      setShowHistoryDetail(false);
      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);
  
  // ========== 历史图纸功能结束 ==========
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 从 newColorData 获取品牌预设数据
  const allBrands = newColorData?.brands || [];
  const needsPalette = PALETTE_REQUIRED_MODES.includes(aiMode);

  // ========== 拼豆尺寸滑块调整 ==========
  // 用于滑块实时拖动显示的尺寸（拖动时不触发请求，只更新数字）
  const [tempSliderSize, setTempSliderSize] = useState<number>(50);
  // 标记是否正在重新采样计算中
  const [isResampling, setIsResampling] = useState(false);

  // 仅调用 Python 切图接口，复用已有 AI 原图重新切片（不消耗 AI 额度）
  const handleResamplePattern = useCallback(async (newSize: number) => {
    if (!optimizeResult?.outputImageUrl || !patternResult) return;
    setIsResampling(true);
    try {
      const squareModes = ['pixelPortrait', 'pixelDoll', 'cutePet', 'cartoon', 'carStyle'];
      const isSquare = squareModes.includes(aiMode);
      // 正方形模式：宽高相等；竖版模式：cartoon 4:5，pixelFullBody 2:3
      const isCartoon = aiMode === 'cartoon';
      const w = isSquare ? newSize : Math.round(newSize / (isCartoon ? 1.25 : 1.5));
      const h = isSquare ? newSize : newSize;

      const res = await fetch('/api/generate-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimizedImageUrl: optimizeResult.outputImageUrl,
          targetWidth: w,
          targetHeight: h,
          colorMode: 'detail',
          aiMode,
          paletteId: needsPalette && selectedPreset ? selectedPreset : 'all',
          brand: selectedBrand,
          customColors: Object.keys(selectedColors).length > 0
            ? Object.entries(selectedColors).map(([code, rgb]) => ({
                masterCode: code,
                displayCode: code,
                brand: selectedBrand,
                hex: '#' + rgb.map((v: number) => v.toString(16).padStart(2, '0')).join(''),
                rgb: rgb,
              }))
            : null,
          maxColors: aiMode === 'pixelDoll' ? 28 : 30,
        }),
      });
      const textRes = await res.text();
      if (!res.ok) throw new Error(textRes.substring(0, 200));
      const data = JSON.parse(textRes);
      if (!data.success) throw new Error(data.error || '重新生成失败');

      // 🚨 破解浏览器缓存：给所有图片 URL 加上时间戳尾巴
      const timestamp = new Date().getTime();
      if (data.previewUrl) data.previewUrl = `${data.previewUrl}${data.previewUrl.includes('?') ? '&' : '?'}t=${timestamp}`;

      setPatternResult(data);
      // 🚨 同步更新全局尺寸状态
      setTargetSize(newSize);
      setTempSliderSize(newSize);

      // 同步更新历史记录
      const currentModeName = AI_MODES.find(m => m.id === aiMode)?.name || '拼豆图纸';
      const codePrefix = generatedBrand?.toLowerCase().includes('mard') ? 'Mard' : (generatedBrand || 'Brand');
      const codeNumber = generatedPreset?.match(/[_-](\d+)/)?.[1] || 'all';
      const historyCode = `${codePrefix}-${codeNumber}`;
      const existingItem = historyList.find(item => item.code === historyCode);
      if (existingItem) {
        updateHistoryItem(existingItem.id, {
          previewUrl: data.previewUrl,
          thumbnail: data.previewUrl,
          size: `${data.actualWidth}x${data.actualHeight}`,
          pixelMatrix: data.pixelMatrix,
          colorStats: data.stats,
          timestamp: Date.now(),
        });
      } else {
        addToHistory(
          data.previewUrl,
          data.previewUrl,
          '',
          '',
          currentModeName,
          `${data.actualWidth}x${data.actualHeight}`,
          historyCode,
          data.pixelMatrix,
          data.stats
        );
      }
    } catch (err: any) {
      console.error('[handleResamplePattern]', err);
    } finally {
      setIsResampling(false);
    }
  }, [optimizeResult, patternResult, aiMode, needsPalette, selectedPreset, selectedBrand, selectedColors, generatedBrand, generatedPreset, historyList, updateHistoryItem, addToHistory, setTargetSize]);

  // 初始化 tempSliderSize（图纸生成后同步）
  useEffect(() => {
    if (patternResult) {
      setTempSliderSize(patternResult.actualWidth);
    }
  }, [patternResult?.actualWidth]);


  
  // ========== 原有代码（继续）==========
  
  // 可用颜色数量 = 用户选择的颜色数量（如果有选择），否则 = 预设限制
  const currentAvailableColorCount = Object.keys(selectedColors).length > 0 
    ? Object.keys(selectedColors).length 
    : countAvailableColors(colorMapping, selectedBrand, needsPalette ? selectedPreset : null);
  // 强制读取当前品牌的【全部色号】，无视任何过滤！
  const editorPalette = useMemo(() => {
    try {
      // 先精确匹配 preset（如 Mard_221）
      const exactBrand = newColorData?.brands?.find((b: any) => 
        b.brandCode === generatedPreset || b.brandCode === `${generatedBrand}_${generatedPreset}`
      );
      if (exactBrand && newColorData?.colorCards?.[exactBrand.id]) {
        const rawColors = newColorData.colorCards[exactBrand.id];
        return rawColors.map((c: any) => {
          const rawHex = c.color || c.hex || '';
          const safeHex = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
          return {
            code: c.colorCode || c.id,
            key: c.colorCode || c.id,
            hex: safeHex.toUpperCase(),
            color: safeHex.toUpperCase(),
            label: c.colorCode || c.id
          };
        });
      }
      
      // 回退：按 groupName 匹配，取 master=true 的预设
      const brandInfo = newColorData?.brands?.find((b: any) => 
        b.groupName?.toLowerCase() === generatedBrand?.toLowerCase() && b.master === true
      );
      if (brandInfo && newColorData?.colorCards?.[brandInfo.id]) {
        const rawColors = newColorData.colorCards[brandInfo.id];
        return rawColors.map((c: any) => {
          const rawHex = c.color || c.hex || '';
          const safeHex = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
          return {
            code: c.colorCode || c.id,
            key: c.colorCode || c.id,
            hex: safeHex.toUpperCase(),
            color: safeHex.toUpperCase(),
            label: c.colorCode || c.id
          };
        });
      }
      
      // 最后回退：取该品牌的最大预设
      const allBrandsForGroup = newColorData?.brands?.filter((b: any) => 
        b.groupName?.toLowerCase() === generatedBrand?.toLowerCase()
      ) || [];
      if (allBrandsForGroup.length > 0) {
        // 按颜色数量排序，取最多的
        allBrandsForGroup.sort((a: any, b: any) => {
          const aCount = newColorData?.colorCards?.[a.id]?.length || 0;
          const bCount = newColorData?.colorCards?.[b.id]?.length || 0;
          return bCount - aCount;
        });
        const maxBrand = allBrandsForGroup[0];
        if (maxBrand && newColorData?.colorCards?.[maxBrand.id]) {
          const rawColors = newColorData.colorCards[maxBrand.id];
          return rawColors.map((c: any) => {
            const rawHex = c.color || c.hex || '';
            const safeHex = rawHex.startsWith('#') ? rawHex : `#${rawHex}`;
            return {
              code: c.colorCode || c.id,
              key: c.colorCode || c.id,
              hex: safeHex.toUpperCase(),
              color: safeHex.toUpperCase(),
              label: c.colorCode || c.id
            };
          });
        }
      }
      
      return [];
    } catch (e) {
      console.error("获取品牌全部颜色失败", e);
      return [];
    }
  }, [generatedBrand, generatedPreset]);
  useEffect(() => {
    if (!showEditor || editorPalette.length === 0) return;
    if (!brushColor || !editorPalette.some((color) => color.code === brushColor.code)) {
      setBrushColor(editorPalette[0]);
    }
  }, [brushColor, editorPalette, showEditor]);

  // 导入修改按钮：打开编辑器 + 显示尺寸滑块
  const handleImportEdit = useCallback(() => {
    if (!patternResult?.pixelMatrix) return;
    try {
      const currentModeName = AI_MODES.find(m => m.id === aiMode)?.name || '拼豆图纸';
      const codePrefix = generatedBrand?.toLowerCase().includes('mard') ? 'Mard' : (generatedBrand || 'Brand');
      const codeNumber = generatedPreset?.match(/[_-](\d+)/)?.[1] || 'all';
      const historyCode = `${codePrefix}-${codeNumber}`;
      const existingItem = historyList.find(item => item.code === historyCode);
      if (existingItem) {
        updateHistoryItem(existingItem.id, {
          pixelMatrix: patternResult.pixelMatrix,
          colorStats: patternResult.stats,
          timestamp: Date.now(),
        });
      } else {
        addToHistory(
          patternResult.previewUrl,
          patternResult.previewUrl,
          '',
          '',
          currentModeName,
          `${patternResult.actualWidth}x${patternResult.actualHeight}`,
          historyCode,
          patternResult.pixelMatrix,
          patternResult.stats
        );
      }
      setEditableMatrix((prev) => {
        if (prev) return prev;
        return JSON.parse(JSON.stringify(patternResult.pixelMatrix));
      });
      const initialColor = (editorPalette && editorPalette.length > 0 && editorPalette[0])
        ? editorPalette[0]
        : { code: '默认', label: '默认', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } };
      setBrushColor(initialColor);
      setShowEditor(true);
      setEditorTool('brush');
      setIsDraggingMode(true);
      // ✅ 同步显示尺寸滑块，初始化为当前图纸尺寸
      setTempSliderSize(patternResult.actualWidth);
      setShowImportSuccessModal(true);
      setTimeout(() => setShowImportSuccessModal(false), 2000);
    } catch (error) {
      console.error("加载编辑器时发生致命错误:", error);
      alert("导入矩阵数据失败，请重试或重新生成图纸。");
    }
  }, [patternResult, aiMode, generatedBrand, generatedPreset, historyList, editorPalette, updateHistoryItem, addToHistory]);

  // 尺寸计算
  // 图纸尺寸：默认正方形 (caroon 也是正方形)
  const patternWidth = targetSize;
  const patternHeight = useMemo(() => {
    if (aiMode === 'pixelFullBody') return Math.round(targetSize * 1.5);
    return targetSize;
  }, [aiMode, targetSize]);
  // 加载预设
  useEffect(() => {
    fetch('/api/palettes')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setColorMapping(colorSystemMapping as ColorMapping);
        }
      })
      .catch(() => setColorMapping(colorSystemMapping as ColorMapping));
  }, []);
  // 恢复自定义选色
  useEffect(() => {
    const key = `palette_${selectedBrand}_${selectedPreset}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 解析为 Set 用于比较，但实际颜色数据从 AIPaletteCenter 组件传递
          return;
        }
      } catch { /* ignore */ }
    }
  }, [selectedBrand, selectedPreset]);
  // 文件处理
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return; }
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOptimizeResult(null);
    setPatternResult(null);
    setError(null);
  }, []);
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-violet-400', 'bg-violet-50');
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50');
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50');
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);
  const handleClearImage = useCallback(() => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setOptimizeResult(null);
    setPatternResult(null);
  }, []);
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setAiImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);
  // 生成
  const handleGenerate = useCallback(async () => {
    if (!selectedImage || isGenerating) return;
    if (needsPalette && !selectedPreset) return;
    setIsGenerating(true);
    setError(null);
    setOptimizeResult(null);
    setPatternResult(null);
    // 显示生成弹窗
    setShowGeneratingModal(true);
    setGeneratingStep(1); // 步骤1: 开始生成
    await new Promise(resolve => setTimeout(resolve, 50)); // 🚨 强制刷新UI
    
    // 先扣减AI次数
    if (!aiTimes.isActivated) {
      setIsGenerating(false);
      setShowGeneratingModal(false);
      setShowAITimesModal(true);
      return;
    }
    
    const deductResult = await aiTimes.decrementTimes();
    if (!deductResult) {
      setIsGenerating(false);
      setShowGeneratingModal(false);
      if (aiTimes.error?.includes('用尽') || aiTimes.error?.includes('次数')) {
        setShowAITimesModal(true);
      } else {
        setError(aiTimes.error || 'AI次数扣减失败');
      }
      return;
    }
    try {
      // 上传
      setGeneratingStep(2); // 步骤2: 上传图片中（最快）
      await new Promise(resolve => setTimeout(resolve, 50)); // 🚨 强制刷新UI
      
      const formData = new FormData();
      formData.append('image', selectedImage);
      const uploadRes = await fetch('/api/temp-image', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || '图片上传失败');
      
      const targetSizeValue = normalizeMaxSide(targetSize);
      let optimizedImageUrl = uploadData.imageUrl;
      
      // AI 转绘（最耗时，必须先设置步骤3再调用API！）
      setGeneratingStep(3); // 步骤3: AI 生成中（最长！）
      await new Promise(resolve => setTimeout(resolve, 100)); // 🚨 强制逼迫浏览器渲染出"步骤3"！
      
      const { width: aiWidth, height: aiHeight } = calculateOptimizeTargetSize(aiMode, aiImageSize.width, aiImageSize.height, targetSizeValue);
      const optimizeRes = await fetch('/api/optimize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiMode,
          provider: 'seedream',
          imageUrl: uploadData.imageUrl,
          referenceImageUrl: aiMode === 'pixelPortrait' ? null : null,
          targetWidth: aiWidth,
          targetHeight: aiHeight,
          targetSize: targetSizeValue,
        }),
      });
      const optimizeData = await optimizeRes.json();
      if (!optimizeData.success) throw new Error(optimizeData.error || 'AI 转绘失败');
      
      setOptimizeResult(optimizeData);
      optimizedImageUrl = optimizeData.outputImageUrl;

      // 生成图纸
      setGeneratingStep(4); // 步骤 4: 生成图纸中
      await new Promise(resolve => setTimeout(resolve, 100)); 
      
      // 🚨 安全的 JSON 解析：拦截非 JSON 的报错（如 500 Internal Server Error 抛出的纯文本）
      const patternRes = await fetch('/api/generate-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimizedImageUrl,
          // 🚨 核心修复：保持后端认识的 Key，将本地变量作为 Value 传入
          targetWidth: typeof patternWidth !== 'undefined' ? patternWidth : 50,
          targetHeight: typeof patternHeight !== 'undefined' ? patternHeight : 50,
          colorMode: 'detail',
          aiMode: aiMode,
          paletteId: needsPalette && typeof selectedPreset !== 'undefined' ? selectedPreset : 'all',
          brand: typeof selectedBrand !== 'undefined' ? selectedBrand : 'MARD',
          // 🚨 新增：将前端精确筛选的颜色数组传给后端
          customColors: Object.keys(selectedColors).length > 0 
            ? Object.entries(selectedColors).map(([code, rgb]) => ({
                masterCode: code,
                displayCode: code,
                brand: selectedBrand,
                hex: '#' + rgb.map((v: number) => v.toString(16).padStart(2, '0')).join(''),
                rgb: rgb,
              }))
            : null,
          // 🚨 强制限制整张图纸最多使用的颜色数量
          // 放宽到 30 给肤色阴影/高光留空间（含 method=0 Median Cut + dither=0 肤色保护）
          maxColors: 30,
        }),
      });

      let patternData;
      try {
        const textRes = await patternRes.text(); // 先按纯文本读取
        if (!patternRes.ok) {
          throw new Error(`服务器异常 (${patternRes.status}): ${textRes.substring(0, 100)}`);
        }
        patternData = JSON.parse(textRes); // 确认没问题再转成 JSON
      } catch (parseError: any) {
        throw new Error(`图纸生成接口返回了无效数据: ${parseError.message}`);
      }

      if (!patternData || !patternData.success) {
        throw new Error(patternData?.error || '图纸生成失败，未返回成功状态');
      }
      setPatternResult(patternData);
      setGeneratedBrand(selectedBrand);
      setGeneratedPreset(selectedPreset);
      setGeneratedSelectedColors({ ...selectedColors });
      setEditableMatrix(null);
      setShowEditor(false);
      setBrushColor(null);
      setGeneratingStep(5); // 步骤5: 生成完成
      await new Promise(resolve => setTimeout(resolve, 500)); // 停留展示一下完成状态
      setShowGeneratingModal(false);
      
      // 保存到历史记录
      const currentModeName = AI_MODES.find(m => m.id === aiMode)?.name || '拼豆图纸';
      const codePrefix = generatedBrand?.toLowerCase().includes('mard') ? 'Mard' : (generatedBrand || 'Brand');
      const codeNumber = generatedPreset?.match(/[_-](\d+)/)?.[1] || 'all';
      const historyCode = `${codePrefix}-${codeNumber}`;
      addToHistory(
        patternData.previewUrl, // thumbnail
        patternData.previewUrl, // previewUrl
        '', // gridUrl (暂无)
        '', // pureUrl (暂无)
        currentModeName,
        `${patternData.actualWidth}x${patternData.actualHeight}`,
        historyCode,
        patternData.pixelMatrix,
        patternData.stats // colorStats
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
      setShowGeneratingModal(false);
    }
  }, [selectedImage, isGenerating, needsPalette, selectedPreset, aiMode, aiImageSize, targetSize, patternWidth, patternHeight, selectedBrand, selectedColors]);

  // ==========================================
  // 📸 下载后同步更新历史记录
  // ==========================================
  const updateHistoryAfterDownload = useCallback((matrix: PixelMatrix) => {
    if (!matrix) return;
    
    // 1. 重新统计颜色数量
    const counts = new Map();
    matrix.forEach(row => row.forEach((cell: any) => {
      if (!cell || !cell.code || cell.code === '未知' || cell.code === 'transparent') return;
      
      // 🚨 核心修复：使用官方辅助函数提取准确的 RGB，再安全转为 HEX
      const safeRgb = getCellRgb(cell);
      const hex = rgbToHex(safeRgb);
      
      if (!counts.has(cell.code)) {
        counts.set(cell.code, { 
          hex, 
          displayCode: cell.code, 
          masterCode: cell.code, 
          count: 0 
        });
      }
      counts.get(cell.code).count++;
    }));
    
    const newStats = Array.from(counts.values()).sort((a: any, b: any) => b.count - a.count);

    // 2. 匹配并更新对应的历史记录
    const codePrefix = generatedBrand?.toLowerCase().includes('mard') ? 'Mard' : (generatedBrand || 'Brand');
    const codeNumber = generatedPreset?.match(/[_-](\d+)/)?.[1] || 'all';
    const historyCode = `${codePrefix}-${codeNumber}`;
    const existingItem = historyList.find(item => item.code === historyCode);

    if (existingItem) {
      updateHistoryItem(existingItem.id, {
        pixelMatrix: JSON.parse(JSON.stringify(matrix)),
        colorStats: newStats,
        timestamp: Date.now()
      });
    }
  }, [generatedBrand, generatedPreset, historyList, updateHistoryItem]);

  // ==========================================
  // 📸 终极一比一复刻 (支持被历史记录弹窗调用)
  // ==========================================
  const handleDownloadHD = useCallback((currentPresetName: string = '默认预设', customMatrix?: PixelMatrix, customViewMode?: 'pixel' | 'grid' | 'pattern') => {
    // 🚨 优先使用传入的矩阵和视图模式
    const matrix = customMatrix || editableMatrix || patternResult?.pixelMatrix;
    const currentViewMode = customViewMode || viewMode;

    if (!matrix || !matrix[0]) return;
    const rows = matrix.length;
    const cols = matrix[0].length;
    // 1. 统计用料
    const stats: Record<string, { r: number; g: number; b: number; code: string; count: number }> = {};
    let totalBeads = 0;
    
    matrix.forEach((row: any[]) => {
      row.forEach((cell: any) => {
        if (!cell || !cell.code || cell.code === '未知' || isTransparentCell(cell)) return;
        
        const code = cell.code;
        let r = 255, g = 255, b = 255;
        if (cell.rgb) { r = cell.rgb.r; g = cell.rgb.g; b = cell.rgb.b; }
        else if (cell.r !== undefined) { r = cell.r; g = cell.g; b = cell.b; }
        if (!stats[code]) {
          stats[code] = { r, g, b, code, count: 0 };
        }
        stats[code].count++;
        totalBeads++;
      });
    });
    const statsArray = Object.values(stats).sort((a: any, b: any) => b.count - a.count);
    // 2. 尺寸与参数设定
    const cellSize = 30;
    const padding = currentViewMode === 'pattern' ? 40 : 20;
    
    // ✅ 修复1: 极度缩小 Header 高度，拉近与图纸的距离
    const headerHeight = currentViewMode === 'pattern' ? 55 : 0;
    const patternWidthCalc = cols * cellSize + padding * 2;
    const patternHeightCalc = rows * cellSize + padding * 2;
    // 3. 计算 12列 统计区高度
    const statsCols = 12;
    let statsHeight = 0;
    if (currentViewMode === 'pattern') {
      const statsRows = Math.ceil(statsArray.length / statsCols);
      // ✅ 配合新的色卡尺寸：boxHeight=56, rowGap=6
      statsHeight = 30 + (statsRows * 62) + 60;
    }
    const canvas = document.createElement('canvas');
    canvas.width = patternWidthCalc;
    canvas.height = headerHeight + patternHeightCalc + statsHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // --- 绘制大白底 ---
    ctx.fillStyle = currentViewMode === 'pixel' ? '#111111' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // --- 🍉 绘制头部 (紧凑间距 + 极简预设名) ---
    if (currentViewMode === 'pattern') {
      const headerY = 28; // 整体往上提，缩小间隙
      ctx.fillStyle = '#222222';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🍉 小瓜拼豆', padding, headerY);
      // ✅ 修复1: 自动剔除 "色" 字，且不显示 "色板预设:"
      // ✅ 修复2: 使用居中的圆点符号 · 替换普通句号 .
      const cleanPresetText = currentPresetName.replace(/色/g, '').trim().replace(/\./g, '·');
      
      ctx.fillStyle = '#555555';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanPresetText, patternWidthCalc - padding, headerY);
    }
    // --- 绘制主图 ---
    const startY = headerHeight;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = matrix[y][x];
        if (!cell || !cell.code || cell.code === '未知' || isTransparentCell(cell)) continue;
        let r = 255, g = 255, b = 255;
        if (cell.rgb) { r = cell.rgb.r; g = cell.rgb.g; b = cell.rgb.b; }
        else if (cell.r !== undefined) { r = cell.r; g = cell.g; b = cell.b; }
        const cx = padding + x * cellSize;
        const cy = startY + padding + y * cellSize;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(cx, cy, cellSize, cellSize);
        if (currentViewMode === 'pattern') {
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          ctx.fillStyle = brightness > 128 ? '#000000' : '#FFFFFF';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const shortCode = (cell.code || '').toString().replace(/[^a-zA-Z0-9]/g, '').slice(-3);
          ctx.fillText(shortCode, cx + cellSize / 2, cy + cellSize / 2);
        }
      }
    }
    // --- 绘制网格线 ---
    if (currentViewMode === 'grid' || currentViewMode === 'pattern') {
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) { ctx.moveTo(padding + i * cellSize, startY + padding); ctx.lineTo(padding + i * cellSize, startY + padding + rows * cellSize); }
      for (let j = 0; j <= rows; j++) { ctx.moveTo(padding, startY + padding + j * cellSize); ctx.lineTo(padding + cols * cellSize, startY + padding + j * cellSize); }
      ctx.lineWidth = 1; ctx.strokeStyle = '#cccccc'; ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= cols; i += 5) { ctx.moveTo(padding + i * cellSize, startY + padding); ctx.lineTo(padding + i * cellSize, startY + padding + rows * cellSize); }
      for (let j = 0; j <= rows; j += 5) { ctx.moveTo(padding, startY + padding + j * cellSize); ctx.lineTo(padding + cols * cellSize, startY + padding + j * cellSize); }
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#333333'; ctx.stroke();
    }
    // --- 🟪 带有【纯黑分割线】的紫色坐标轴 ---
    if (currentViewMode === 'pattern') {
      const axisThickness = 24;
      ctx.fillStyle = '#8b5cf6';
      
      ctx.fillRect(padding - axisThickness, startY + padding - axisThickness, cols * cellSize + axisThickness * 2, axisThickness);
      ctx.fillRect(padding - axisThickness, startY + padding + rows * cellSize, cols * cellSize + axisThickness * 2, axisThickness);
      ctx.fillRect(padding - axisThickness, startY + padding, axisThickness, rows * cellSize);
      ctx.fillRect(padding + cols * cellSize, startY + padding, axisThickness, rows * cellSize);
      // 纯黑加粗分割线 (#000000)
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      
      for (let x = 0; x <= cols; x++) {
        ctx.moveTo(padding + x * cellSize, startY + padding - axisThickness);
        ctx.lineTo(padding + x * cellSize, startY + padding);
        ctx.moveTo(padding + x * cellSize, startY + padding + rows * cellSize);
        ctx.lineTo(padding + x * cellSize, startY + padding + rows * cellSize + axisThickness);
      }
      for (let y = 0; y <= rows; y++) {
        ctx.moveTo(padding - axisThickness, startY + padding + y * cellSize);
        ctx.lineTo(padding, startY + padding + y * cellSize);
        ctx.moveTo(padding + cols * cellSize, startY + padding + y * cellSize);
        ctx.lineTo(padding + cols * cellSize + axisThickness, startY + padding + y * cellSize);
      }
      ctx.stroke();
      // 画数字 (白色)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let x = 0; x < cols; x++) {
        const cx = padding + x * cellSize + cellSize / 2;
        ctx.fillText((x + 1).toString(), cx, startY + padding - axisThickness / 2);
        ctx.fillText((x + 1).toString(), cx, startY + padding + rows * cellSize + axisThickness / 2);
      }
      for (let y = 0; y < rows; y++) {
        const cy = startY + padding + y * cellSize + cellSize / 2;
        ctx.fillText((y + 1).toString(), padding - axisThickness / 2, cy);
        ctx.fillText((y + 1).toString(), padding + cols * cellSize + axisThickness / 2, cy);
      }
    }
    // --- 💊 终极复刻：完美双拼圆角卡片 (上半截颜色+下半截白色) ---
    if (currentViewMode === 'pattern') {
      const statsStartY = headerHeight + patternHeightCalc + 30;
      
      // ✅ 修复：方块宽度78铺满，横向间隙由计算得出
      const boxWidth = 78;
      const boxHeight = 48;
      const radius = 6;
      const rowGap = 6;
      const colWidth = (patternWidthCalc - padding * 2) / statsCols;
      statsArray.forEach((stat: any, index: number) => {
        const col = index % statsCols;
        const row = Math.floor(index / statsCols);
        
        // 左对齐铺满
        const itemX = padding + col * colWidth;
        const itemY = statsStartY + row * (boxHeight + rowGap);
        // === 1. 裁剪圆角轮廓 (最关键的魔法) ===
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(itemX, itemY, boxWidth, boxHeight, radius);
        else ctx.rect(itemX, itemY, boxWidth, boxHeight);
        ctx.clip(); // 开启裁剪，颜色不会溢出圆角
        // === 2. 上半截：豆子颜色 ===
        ctx.fillStyle = `rgb(${stat.r}, ${stat.g}, ${stat.b})`;
        ctx.fillRect(itemX, itemY, boxWidth, boxHeight / 2);
        // === 3. 下半截：纯白底色 ===
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(itemX, itemY + boxHeight / 2, boxWidth, boxHeight / 2);
        ctx.restore(); // 取消裁剪
        // === 4. 上半截文字 (色号，根据颜色深浅智能变色) ===
        const brightness = (stat.r * 299 + stat.g * 587 + stat.b * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#111827' : '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stat.code, itemX + boxWidth / 2, itemY + boxHeight / 4);
        // === 5. 下半截文字 (数量，纯黑色，不带×) ===
        ctx.fillStyle = '#111827';
        ctx.font = '12px Arial';
        ctx.fillText(stat.count.toString(), itemX + boxWidth / 2, itemY + boxHeight * 0.75);
        // === 6. 极细的高级灰外边框 ===
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(itemX, itemY, boxWidth, boxHeight, radius);
        else ctx.rect(itemX, itemY, boxWidth, boxHeight);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#e5e7eb';
        ctx.stroke();
      });
      // 右下角总计汇总
      ctx.fillStyle = '#444444';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`色号数: ${statsArray.length} 色      豆子数: ${totalBeads} 颗`, patternWidthCalc - padding, canvas.height - 15);
    }
    // 触发下载
    const link = document.createElement('a');
    link.download = `小瓜图纸_${currentViewMode}_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [editableMatrix, patternResult, viewMode]);

  // 原有下载函数
  const handleDownloadPattern = useCallback(() => {
    if (!patternResult?.previewUrl) return;
    fetch(patternResult.previewUrl).then(r => r.blob()).then(blob => {
      downloadBlob(blob, `拼豆图纸_${patternResult.actualWidth}x${patternResult.actualHeight}.png`);
    });
  }, [patternResult]);

  const handleReset = useCallback(() => {
    setPatternResult(null);
    setOptimizeResult(null);
    setEditableMatrix(null);
    setShowEditor(false);
    setBrushColor(null);
  }, []);

  const handleMirrorEdit = useCallback(() => {
    setEditableMatrix((prev) => prev ? prev.map((row) => [...row].reverse()) : prev);
  }, []);

  const displayPixelMatrix = editableMatrix ?? patternResult?.pixelMatrix;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f4ef] text-slate-950">
      {/* 生成中弹窗 */}
      {showGeneratingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-in fade-in zoom-in-95 duration-300 rounded-3xl bg-white p-8 shadow-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <svg className="h-8 w-8 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-900">正在生成拼豆图纸</h3>
              <p className="text-sm text-slate-500">依据网络和设备性能，生成时间约 30-60 秒</p>
            </div>
            
            {/* 进度条 */}
            <div className="mb-6">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-600">生成进度</span>
                <span className="font-medium text-slate-900">{Math.round((generatingStep / 5) * 100)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out"
                  style={{ width: `${(generatingStep / 5) * 100}%` }}
                />
              </div>
            </div>
            
            {/* 步骤说明 */}
            <div className="space-y-3">
              {[
                { step: 1, label: '开始生成', done: generatingStep > 1 },
                { step: 2, label: '上传图片中', done: generatingStep > 2 },
                { step: 3, label: 'AI 生成中', done: generatingStep > 3 },
                { step: 4, label: '生成图纸中', done: generatingStep > 4 },
                { step: 5, label: '生成完成', done: generatingStep > 5 },
              ].map(({ step, label, done }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                    done ? 'bg-green-500 text-white' : generatingStep === step ? 'bg-violet-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'
                  )}>
                    {done ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step}
                  </div>
                  <span className={cn(
                    'text-sm',
                    done ? 'text-green-600 font-medium' : generatingStep === step ? 'text-violet-600 font-medium' : 'text-slate-400'
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            
            <p className="mt-6 text-center text-xs text-slate-400">
              请勿关闭页面，生成完成后将自动展示结果
            </p>
          </div>
        </div>
      )}

      {/* 导入成功弹窗 */}
      {showImportSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-95 duration-300 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-900">已导入成功</p>
                <p className="text-sm text-slate-500">请下滑查看</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-120px] h-72 w-72 rounded-full bg-violet-300/45 blur-3xl" />
        <div className="absolute right-[-120px] top-28 h-80 w-80 rounded-full bg-fuchsia-300/45 blur-3xl" />
        <div className="absolute bottom-[-140px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:24px_24px] opacity-35" />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-5 sm:py-8 lg:px-8">
        {/* 头部 */}
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_30px_100px_-50px_rgba(15,23,42,0.7)] backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">小瓜像素图生成器</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              按从上到下的流程完成：上传图片、选择风格、设置尺寸、选择色板，最后生成拼豆图纸 - 1豆。
            </p>
          </div>
          <div className="mt-6 grid grid-cols-5 gap-2 rounded-3xl bg-slate-950 p-2 text-white shadow-2xl shadow-slate-950/20">
            {['上传', '风格', '尺寸', '色板', '生成'].map((item, index) => (
              <div key={item} className={cn('rounded-2xl p-2 text-center sm:p-3', index === 4 ? 'bg-white text-slate-950' : 'bg-white/10')}>
                <p className={cn('text-[9px] font-bold uppercase tracking-widest sm:text-[10px]', index === 4 ? 'text-slate-400' : 'text-white/40')}>Step {index + 1}</p>
                <p className="mt-1 text-xs font-black sm:text-sm">{item}</p>
              </div>
            ))}
          </div>
        </header>
        <div className="flex flex-col gap-5">
          {/* Step 1: 上传图片 */}
          <SectionCard>
            <SectionHeader step="Step 1" title="上传图片" desc="支持 jpg / png / webp，手机端可直接选择相册" icon={<IconImage />} />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
              className="group relative flex min-h-[220px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-all duration-300 hover:border-violet-400 hover:bg-violet-50 sm:min-h-[280px]"
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              {previewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="预览"
                    className="max-h-56 max-w-full rounded-[1.5rem] object-contain shadow-2xl ring-8 ring-white"
                    onLoad={handleImageLoad}
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClearImage();
                    }}
                    className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl transition-transform hover:scale-110"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white text-slate-400 shadow-sm transition-all group-hover:scale-105 group-hover:text-violet-500">
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">点击或拖拽上传图片</p>
                    <p className="mt-1 text-sm text-slate-500">建议使用主体清晰、背景简洁的图片</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
          {/* Step 2: AI 风格模式 */}
          <SectionCard>
            <SectionHeader step="Step 2" title="AI 风格模式" desc="选择生成风格" icon={<IconPalette />} />
            <div className="grid grid-cols-3 gap-3">
              {AI_MODES.map((mode, index) => {
                const active = aiMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setAiMode(mode.id)}
                    className="relative aspect-square overflow-hidden rounded-2xl border-2 transition-all duration-300"
                    style={{
                      borderColor: active ? '#e11d48' : '#e5e7eb',
                      backgroundColor: active ? '#fef2f4' : '#ffffff',
                    }}
                  >
                    {/* 图片区域 */}
                    <div className="h-3/4 w-full overflow-hidden">
                      <img 
                        src={mode.image} 
                        alt={mode.name}
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                    
                    {/* 文字区域 */}
                    <div className="flex h-1/4 flex-col items-center justify-center gap-0.5">
                      <span className="text-xs font-bold" style={{ color: active ? '#e11d48' : '#374151' }}>
                        {mode.name}
                      </span>
                      {active && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
          {/* Step 3: 目标尺寸 */}
          <SectionCard>
            <SectionHeader step="Step 3" title="目标尺寸" desc="控制图纸颗粒数" icon={<IconSize />} />
            
            {/* 固定尺寸快捷按钮 */}
            <div className="mb-4 flex gap-2">
              {[52, 80, 104].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTargetSize(size)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-bold transition-all',
                    targetSize === size
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
            
            <div className="rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-slate-500">边长</span>
                <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">{targetSize}</span>
              </div>
              <input
                type="range"
                min={20}
                max={200}
                value={targetSize}
                onChange={(event) => setTargetSize(Number(event.target.value))}
                className="mt-5 h-3 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricCard label="图纸尺寸" value={`${patternWidth} × ${patternHeight}`} tone="violet" />
              <MetricCard label="颗粒总数" value={(patternWidth * patternHeight).toLocaleString()} tone="amber" />
            </div>
          </SectionCard>
        {/* Step 4: 拼豆色板 */}
        <SectionCard>
          <SectionHeader
            step="Step 4"
            title="拼豆色板"
            desc="品牌与预设保持原来的选择方式；色板中心组件不改"
            icon={<IconPalette />}
            action={
              <div className="flex items-center gap-3">
                {aiTimes.remainingTimes > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPaletteCenter(!showPaletteCenter)}
                    className="rounded-full bg-green-600 px-4 py-2 text-xs font-black text-white shadow-lg transition-all hover:-translate-y-0.5 sm:text-sm"
                  >
                    剩余{aiTimes.remainingTimes}豆
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPaletteCenter(!showPaletteCenter)}
                  className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg transition-all hover:-translate-y-0.5 sm:text-sm"
                >
                  {showPaletteCenter ? '收起' : '展开色板'}
                </button>
              </div>
            }
          />
          {/* 🚨 修复核心：删掉强制左右分列的 grid，改为纯上下排列的 flex-col */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">品牌</p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSelectedColors({});
                      setSelectedBrand(item);
                      const presets = allBrands.filter((b: { groupName: string }) => b.groupName === item);
                      console.log('[品牌切换]', item, '找到预设:', presets.map(p => p.brandCode));
                      if (presets.length > 0) {
                        // 🚨 修复：使用实际颜色数量排序，而不是 colorCount 字段（很多品牌没有这个字段）
                        presets.sort((a, b) => {
                          const aColors = newColorData.colorCards[a.id]?.length || 0;
                          const bColors = newColorData.colorCards[b.id]?.length || 0;
                          return bColors - aColors; // 降序：最多的在前
                        });
                        console.log('[品牌切换] 排序后预设:', presets.map(p => `${p.brandCode}(${newColorData.colorCards[p.id]?.length || 0}色)`));
                        setSelectedPreset(presets[0].brandCode);
                        console.log('[品牌切换] 选择预设:', presets[0].brandCode);
                      } else {
                        console.log('[品牌切换] 警告：未找到预设，保持原值');
                      }
                    }}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-black transition-all',
                      // 保持无视大小写，让选中的品牌正确变绿
                      selectedBrand?.toLowerCase() === item.toLowerCase() 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            {/* 🚨 让可用颜色的绿框变成占据 100% 宽度的长条 (w-full) */}
            <div className="w-full rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-950 ring-1 ring-emerald-100">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-55">可用颜色</span>
              <p className="mt-1 text-2xl font-black">{currentAvailableColorCount}色</p>
            </div>
          </div>
        </SectionCard>
          {/* 色板中心模态框 */}
          {showPaletteCenter && (
            <AIPaletteCenter
              isOpen={true}
              onClose={() => setShowPaletteCenter(false)}
              selectedBrand={selectedBrand}
              selectedPresetId={selectedPreset}
              onSave={(colors, brand, preset) => {
                setSelectedBrand(brand);
                // 如果有预设，使用预设；否则自动选择该品牌的最大预设
                if (preset) {
                  setSelectedPreset(preset);
                } else {
                  // 自动选择该品牌的最大预设
                  const brandPresets = allBrands.filter((b: { groupName: string }) => b.groupName === brand);
                  if (brandPresets.length > 0) {
                    brandPresets.sort((a: { colorCount?: number }, b: { colorCount?: number }) => (b.colorCount || 0) - (a.colorCount || 0));
                    setSelectedPreset(brandPresets[0].brandCode);
                  }
                }
                setSelectedColors(colors);
                setShowPaletteCenter(false);
              }}
            />
          )}
          {/* 生成按钮 */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedImage || isGenerating}
            className={cn(
              'group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.6rem] px-5 py-4 text-base font-black shadow-2xl transition-all duration-300 sm:py-5 sm:text-lg',
              !selectedImage || isGenerating ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-slate-950 text-white hover:-translate-y-0.5 hover:shadow-slate-950/30 active:translate-y-0',
            )}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{progressInfo}</span>
              </>
            ) : (
              <>
                <IconBolt />
                生成拼豆图纸 - 1豆
              </>
            )}
          </button>
          {/* 错误提示 */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}
          {/* 提示 */}
          {needsPalette && !selectedPreset && selectedImage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-medium text-amber-600">请先选择色板预设</p>
            </div>
          )}
          {/* 结果区域 */}
          {optimizeResult || patternResult ? (
            <div className="flex flex-col gap-5">
              {/* AI 效果图 */}
              {optimizeResult && (
                <SectionCard>
                  <SectionHeader step="Result 1" title="AI 效果图" desc="转绘完成后会显示在这里" icon={<IconImage />} />
                  <div className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-violet-200 via-pink-200 to-amber-100 p-8 shadow-inner ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={optimizeResult.outputImageUrl} alt="AI 效果" className="mx-auto max-h-96 rounded-2xl shadow-2xl" />
                  </div>
                </SectionCard>
              )}
              {/* 拼豆图纸预览 */}
              {patternResult && (
                <SectionCard>
                  <SectionHeader step="Result 2" title="拼豆图纸预览" desc="确认无误后可下载图纸" icon={<IconImage />} />
                  <div className="mb-3 sm:mb-4 grid grid-cols-2 gap-2 sm:gap-3">
                    <MetricCard label="尺寸" value={`${patternResult.actualWidth} × ${patternResult.actualHeight}`} tone="violet" />
                    <MetricCard label="颗粒" value={patternResult.totalBeads.toLocaleString()} tone="amber" />
                    <MetricCard label="可用颜色" value={`${currentAvailableColorCount}色`} tone="emerald" />
                    <MetricCard label="实际使用" value={`${patternResult.colorCount}种`} tone="slate" />
                  </div>
                  {/* ======================================= */}
                  {/* 1. 上方：主视觉大图展示区 */}
                  {/* ======================================= */}
                  <div className="mb-4 w-full h-[300px] sm:h-[450px] bg-gray-50 border border-gray-200 rounded-xl overflow-auto p-2 sm:p-4 flex justify-center items-start shadow-inner">
                    {displayPixelMatrix ? (
                      <PixelCanvas 
                        matrix={displayPixelMatrix} 
                        mode={viewMode}
                        isThumbnail={false}
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-gray-400">
                        正在加载图纸数据...
                      </div>
                    )}
                  </div>
                  {/* ======================================= */}
                  {/* 2. 下方：三个模式切换卡片 */}
                  {/* ======================================= */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-5">
                    {[
                      { id: 'pixel' as const, title: '效果图' },
                      { id: 'grid' as const, title: '网格图' },
                      { id: 'pattern' as const, title: '拼豆图' },
                    ].map(mode => (
                      <div
                        key={mode.id}
                        onClick={() => setViewMode(mode.id)}
                        className={cn(
                          'flex flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl cursor-pointer border-2 transition-all',
                          viewMode === mode.id 
                            ? 'border-[#ff4d6d] bg-[#fff5f7]' 
                            : 'border-gray-100 bg-white hover:border-[#ff4d6d]/50 hover:shadow-sm'
                        )}
                      >
                        {/* 左侧的小方块：真正的缩略图 */}
                        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center p-0.5 sm:p-1 shadow-sm">
                          {displayPixelMatrix && (
                            <PixelCanvas 
                              matrix={displayPixelMatrix} 
                              mode={mode.id}
                              isThumbnail={true}
                            />
                          )}
                        </div>
                        {/* 右侧的文字 */}
                        <span className={cn('font-bold text-xs sm:text-sm', viewMode === mode.id ? 'text-[#ff4d6d]' : 'text-gray-700')}>
                          {mode.title}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* ======================================= */}
                  {/* 3. 拼豆尺寸滑块（点击"导入修改"后显示） */}
                  {/* ======================================= */}
                  {patternResult && (
                    <div className="p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-violet-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-700">拼豆网格尺寸</span>
                          {isResampling && (
                            <span className="text-xs text-violet-500 animate-pulse">重新切图中...</span>
                          )}
                        </div>
                        <span className="text-sm sm:text-base font-black text-violet-600 tabular-nums">
                          {tempSliderSize} × {tempSliderSize}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min={20} 
                        max={200} 
                        value={tempSliderSize}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={(e) => setTempSliderSize(Number(e.target.value))}
                        onMouseUp={() => handleResamplePattern(tempSliderSize)}
                        onTouchEnd={() => handleResamplePattern(tempSliderSize)}
                        disabled={isResampling || !optimizeResult?.outputImageUrl}
                      />
                      <p className="mt-1.5 text-xs text-slate-400">
                        {isResampling ? '正在重新计算色块用料...' : '拖动滑块调整尺寸，松开后自动重新切片（不消耗 AI 额度）'}
                      </p>
                    </div>
                  )}
                  <div className="mb-4 sm:mb-5">
                    <h4 className="mb-2 sm:mb-3 text-[13px] sm:text-sm font-black text-slate-900">颜色统计</h4>
                    <div className="max-h-40 sm:max-h-56 overflow-y-auto rounded-xl sm:rounded-[1.25rem] border border-slate-200 bg-white p-1.5 sm:p-2">
                      {patternResult.stats?.map((color) => (
                        <div key={color.masterCode} className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 transition-colors hover:bg-slate-50">
                          <div className="h-7 w-7 sm:h-9 sm:w-9 shrink-0 rounded-lg sm:rounded-xl border border-slate-200 shadow-sm" style={{ backgroundColor: color.hex }} />
                          <span className="w-16 sm:w-20 rounded-lg sm:rounded-xl bg-slate-100 px-1.5 sm:px-2 py-0.5 sm:py-1 text-center font-mono text-xs sm:text-sm font-black text-slate-900">{color.displayCode}</span>
                          <span className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-slate-500">{color.count}颗</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      onClick={() => {
                        // 修复：支持 _数字 和 -数字 两种格式（如 Mard_221 或 Artkal-418）
                        const presetMatch = generatedPreset?.match(/[_-](\d+)$/);
                        const presetCount = presetMatch ? presetMatch[1] : '';
                        const fullName = generatedBrand && presetCount ? `${generatedBrand}.${presetCount}色` : '默认预设';
                        handleDownloadHD(fullName);
                        // 🚨 同步保存修改到历史记录
                        if (editableMatrix) {
                          updateHistoryAfterDownload(editableMatrix);
                        }
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 font-black text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 w-full"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {editableMatrix ? '下载修改后图纸' : viewMode === 'pattern' ? '下载高清施工图纸' : viewMode === 'grid' ? '下载网格图' : '下载效果图'}
                    </button>
                    <button
                      onClick={handleImportEdit}
                      disabled={!patternResult.pixelMatrix}
                      className="rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white shadow-lg shadow-violet-600/20 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 active:translate-y-0 w-full"
                    >
                      导入修改
                    </button>
                    <button
                      onClick={handleReset}
                      className="rounded-2xl bg-slate-100 px-5 py-3.5 font-black text-slate-700 transition-all hover:bg-slate-200 w-full"
                    >
                      重新生成
                    </button>
                  </div>
                </SectionCard>
              )}
              {/* 增加 editableMatrix.length > 0 校验，确保矩阵绝对不为空 */}
              {showEditor && editableMatrix && editableMatrix.length > 0 ? (
                <PatternEditorPanel
                    matrix={editableMatrix}
                    setMatrix={setEditableMatrix}
                    palette={editorPalette || []}
                    patternStats={patternResult?.stats || []}
                    tool={editorTool}
                    setTool={setEditorTool}
                    brushColor={brushColor || ''}
                    setBrushColor={setBrushColor}
                    isDraggingMode={isDraggingMode}
                    setIsDraggingMode={setIsDraggingMode}
                    onMirror={typeof handleMirrorEdit === 'function' ? handleMirrorEdit : undefined}
                    onDownload={() => {
                      const presetMatch = generatedPreset?.match(/[_-](\d+)$/);
                      const presetCount = presetMatch ? presetMatch[1] : '';
                      const fullName = generatedBrand && presetCount ? `${generatedBrand}.${presetCount}色` : '默认预设';
                      handleDownloadHD(fullName);
                    }}
                  />
                ) : null}
              </div>
            ) : (
            <SectionCard>
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-white text-slate-400 shadow-sm">
                  <IconImage />
                </div>
                <p className="text-lg font-black text-slate-900">上传图片开始生成</p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">AI 转绘完成后，会自动在这里展示拼豆图纸、颜色统计和下载按钮。</p>
              </div>
            </SectionCard>
          )}
        </div>
        
        {/* 历史图纸抽屉 - 始终显示 */}
        <div className="px-3 sm:px-4">
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <HistoryDrawer
              isOpen={historyDrawerOpen}
              onToggle={() => setHistoryDrawerOpen(!historyDrawerOpen)}
              historyList={historyList}
              onItemClick={openHistoryDetail}
              onDelete={deleteFromHistory}
              isAtBottom={hasContent}
            />
          </div>
        </div>
        
        <footer className="pb-3 pt-1 text-center text-xs font-semibold text-slate-400 sm:text-sm">
          小瓜AI拼豆像素图生成器
        </footer>
      </div>
      {/* AI次数激活弹窗 */}
      <AITimesActivationModal
        isOpen={showAITimesModal}
        onClose={() => setShowAITimesModal(false)}
        aiTimes={aiTimes}
        onSuccess={() => setShowAITimesModal(false)}
      />
      
      {/* 历史图纸详情弹窗 */}
      <HistoryDetailModal
        item={historyDetailItem}
        isOpen={showHistoryDetail}
        onClose={closeHistoryDetail}
        colorStats={historyDetailItem?.colorStats || []}
        onDownloadHD={(item, targetView) => {
          // 将弹窗里的 'perler' 映射为主页面的 'pattern'
          const mappedView = targetView === 'perler' ? 'pattern' : targetView;
          
          // 解析品牌和预设用于显示在图纸右上角
          const presetMatch = generatedPreset?.match(/[_-](\d+)$/);
          const presetCount = presetMatch ? presetMatch[1] : '';
          const fullName = generatedBrand && presetCount ? `${generatedBrand}.${presetCount}色` : '历史图纸';
          
          // 🚀 正式调用高清引擎绘制历史记录！
          handleDownloadHD(fullName, item.pixelMatrix, mappedView);
        }}
      />
    </main>
  );
}
