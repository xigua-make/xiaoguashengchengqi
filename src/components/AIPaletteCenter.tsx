'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Search, X, Check, Palette, Sparkles, Layers3 } from 'lucide-react';
import newColorData from '@/data/ai-newColorData.json';

type BrandType = 'Mard' | 'CoCo' | '漫漫' | '盼盼' | '咪小窝' | '黄豆豆' | 'DoDo' | '小舞' | '卡卡' | '优肯' | '柿柿' | '童趣';

interface ColorItem {
  code: string; // 唯一标识符（使用索引，如 C23_15）
  originalCode: string; // 原始色号（可能有重复）
  rgb: [number, number, number];
  hex: string;
  index: number; // 原始索引
}

interface RawBrand {
  id: number;
  brandCode: string;
  brandName: string;
  groupName: string;
  orderNo: number;
  master: boolean;
  type: number;
}

// 组件外提：移到文件顶层
const ModalWrapper = ({ children, embedded, onClose }: { children: React.ReactNode, embedded: boolean, onClose: () => void }) =>
  !embedded ? (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/55 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[60vh] sm:h-auto max-h-[60vh] sm:max-h-[92vh] w-[95vw] sm:w-full max-w-[95vw] sm:max-w-7xl flex-col overflow-hidden rounded-t-[24px] sm:rounded-[28px] bg-white shadow-2xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  ) : <>{children}</>;

const ModalContent = ({ children, embedded }: { children: React.ReactNode, embedded: boolean }) =>
  embedded ? (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg">
      {children}
    </div>
  ) : <>{children}</>;

const rawBrands = newColorData.brands as RawBrand[];
const rawColorCards = newColorData.colorCards as Record<string, { color: string; colorCode: string; displayOrder: number }[]>;

const brandColorsMap: Record<string, ColorItem[]> = {};
for (const [id, colors] of Object.entries(rawColorCards)) {
  const brand = rawBrands.find(b => b.id === parseInt(id));
  if (brand) {
    // ========== 🚨 终极防冲突数据清洗 ==========
    const localSeenCodes = new Set<string>();
    const cleanColors: ColorItem[] = [];

    colors.forEach((c: any) => {
      let baseCode = c.colorCode || c.id;
      if (!baseCode) return;

      let finalCode = baseCode;
      let suffix = 1;
      
      // 🚨 核心：无差别防撞名！不管什么品牌，只要名字冲突，一直加后缀直到绝对唯一！
      while (localSeenCodes.has(finalCode)) {
        finalCode = `${baseCode}-${suffix}`;
        suffix++;
      }
      localSeenCodes.add(finalCode);

      cleanColors.push({
        ...c,
        id: finalCode, // 强制唯一，防止字典覆盖
        code: finalCode,
        originalCode: c.colorCode,
        colorCode: finalCode,
        hex: c.color.toUpperCase(),
        rgb: hexToRgb(c.color),
        index: cleanColors.length,
      });
    });
    // ====================================

    brandColorsMap[brand.brandCode] = cleanColors;
  }
}

// 🔍 调试日志：检查初始化后的 brandColorsMap
console.log(`[DEBUG] brandColorsMap['Mard_24'] 初始化长度: ${brandColorsMap['Mard_24']?.length}`);
console.log(`[DEBUG] brandColorsMap['Mard_48'] 初始化长度: ${brandColorsMap['Mard_48']?.length}`);
console.log(`[DEBUG] brandColorsMap['Mard_72'] 初始化长度: ${brandColorsMap['Mard_72']?.length}`);
console.log(`[DEBUG] brandColorsMap['KaKa_286'] 初始化长度: ${brandColorsMap['KaKa_286']?.length}`);
console.log(`[DEBUG] brandColorsMap['Artkal-197'] 初始化长度: ${brandColorsMap['Artkal-197']?.length}`);
console.log(`[DEBUG] brandColorsMap['Artkal-418'] 初始化长度: ${brandColorsMap['Artkal-418']?.length}`);
console.log(`[DEBUG] brandColorsMap['Artkal_5MM'] 初始化长度: ${brandColorsMap['Artkal_5MM']?.length}`);

const allGroups = [...new Set(rawBrands.map(b => b.groupName))];

function getPresetsByGroup(groupName: string) {
  return rawBrands
    .filter(b => b.groupName === groupName)
    .map(b => {
      // 🎯 使用 getColorsByPreset 拦截器的清洗后长度，确保与UI显示完全一致！
      const colorCount = getColorsByPreset(b.brandCode, b.groupName).length;
      
      return {
        brandCode: b.brandCode,
        brandName: b.brandName,
        colorCount,
      };
    })
    .sort((a, b) => a.colorCount - b.colorCount);
}

function getColorsByPreset(brandCode: string | null, groupName: string): ColorItem[] {
  // 🔍 调试日志
  if (groupName === '卡卡' && brandCode) {
    console.log(`[DEBUG] getColorsByPreset 卡卡: brandCode=${brandCode}, brandColorsMap[brandCode].length=${brandColorsMap[brandCode]?.length || 'undefined'}`);
  }
  
  let colors: ColorItem[] = [];

  // 全选模式：使用 brandColorsMap 的清洗后数据
  if (!brandCode || brandCode === 'custom' || brandCode === '全部') {
    // 🎯 统一使用 brandColorsMap（清洗后的数据），保持与预设按钮数量一致！
    const allPresets = rawBrands.filter(b => b.groupName === groupName);
    const map = new Map<string, ColorItem>();
    allPresets.forEach(preset => {
      const presetColors = brandColorsMap[preset.brandCode] || [];
      presetColors.forEach(c => {
        if (!map.has(c.code)) { // 严格判定，避免覆盖或遗漏
          map.set(c.code, c);
        }
      });
    });
    colors = Array.from(map.values());
  } else {
    colors = brandColorsMap[brandCode] || [];
  }

  // ========== 🚨 终极双重过滤拦截器 ==========
  const finalCleaned: any[] = [];
  
  // 1. 用于过滤"预设合并"带来的完全相同的珠子（依据 hex + code）
  const seenExactBead = new Set<string>();
  
  // 2. 用于处理真正的"同色号冲突"（依据 code）
  const seenCodeCount = new Map<string, number>();

  colors.forEach(c => {
    const targetCode = c.code || c.colorCode || c.id;
    if (!targetCode) return;

    // 【第一重过滤】：消除多预设合并带来的 100% 重叠的假重复
    const exactId = `${c.hex}_${targetCode}`;
    if (seenExactBead.has(exactId)) {
      return; // 这个珠子在前面的预设里已经加过了，直接抛弃！
    }
    seenExactBead.add(exactId);

    // 【第二重过滤】：处理名字相同的真实冲突（比如优肯特有的重复色号）
    if (seenCodeCount.has(targetCode)) {
      const isYuken = groupName === '优肯' || (c.brandCode || '').includes('优肯') || c.brandName === '优肯';
      
      if (isYuken) {
        // 🎯 优肯特判：保留真实的同名冲突色，并追加 -1, -2 后缀
        const count = seenCodeCount.get(targetCode)!;
        seenCodeCount.set(targetCode, count + 1);
        finalCleaned.push({
          ...c,
          code: `${targetCode}-${count}`,
          colorCode: `${targetCode}-${count}`,
          id: `${targetCode}-${count}`
        });
      } else {
        // 🎯 MARD、卡卡、盼盼等：即便有同名冲突，也严格丢弃！
        return; 
      }
    } else {
      // 第一次遇到的全新色号
      seenCodeCount.set(targetCode, 1);
      finalCleaned.push(c);
    }
  });

  return finalCleaned; // 🚨 强制返回清洗后的干净数组
}

interface AIPaletteCenterProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedColors?: Record<string, [number, number, number]>;
  selectedBrand?: BrandType;
  selectedPresetId?: string | null;
  onSave?: (
    colors: Record<string, [number, number, number]>,
    brand: BrandType,
    presetId: string
  ) => void;
  embedded?: boolean;
}

const BRAND_GRADIENTS: Record<string, string> = {
  MARD: 'from-violet-500 to-purple-600',
  COCO: 'from-pink-500 to-rose-600',
  '漫漫': 'from-amber-500 to-orange-600',
  '盼盼': 'from-emerald-500 to-teal-600',
  '咪小窝': 'from-cyan-500 to-blue-600',
  'Mard': 'from-violet-500 to-purple-600',
  '黄豆豆': 'from-yellow-500 to-amber-600',
  'DoDo': 'from-teal-500 to-emerald-600',
  'CoCo': 'from-pink-500 to-rose-600',
  '小舞': 'from-red-500 to-orange-600',
  '卡卡': 'from-indigo-500 to-blue-600',
  '优肯': 'from-green-500 to-teal-600',
  '柿柿': 'from-orange-500 to-red-600',
  '童趣': 'from-blue-500 to-indigo-600',
};

const OLD_TO_NEW_BRAND: Record<string, string> = {
  'MARD': 'Mard',
  'COCO': 'CoCo',
  '漫漫': '漫漫',
  '盼盼': '盼盼',
  '咪小窝': '咪小窝',
};

const NEW_TO_OLD_BRAND: Record<string, string> = {
  'Mard': 'MARD',
  'CoCo': 'COCO',
  '漫漫': '漫漫',
  '盼盼': '盼盼',
  '咪小窝': '咪小窝',
};

function formatCode(code: string): string {
  // 处理带索引的色号，如 C23_15 -> C23-2 (重复色号)
  const match = code.match(/^([A-Za-z]+)(\d+)_\d+$/);
  if (match) {
    const letter = match[1];
    const num = parseInt(match[2]);
    const suffix = parseInt(code.split('_')[1]) + 1;
    return `${letter}${num}-${suffix}`;
  }
  // 普通色号直接返回，不添加空格
  return code;
}

function parseCodeParts(code: string): { prefix: string; number: number; raw: string } {
  const match = code.match(/^([A-Za-z]+)(\d+)$/);
  if (match) return { prefix: match[1], number: parseInt(match[2], 10), raw: code };
  const numeric = code.match(/^(\d+)$/);
  if (numeric) return { prefix: '', number: parseInt(numeric[1], 10), raw: code };
  return { prefix: code, number: 0, raw: code };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const bigint = parseInt(clean, 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255,
  ];
}

export default function AIPaletteCenter({
  isOpen = true,
  onClose = () => {},
  selectedBrand = 'Mard',
  selectedPresetId = 'Mard_221',
  onSave = () => {},
  embedded = false,
  selectedColors = {},
}: Partial<AIPaletteCenterProps> & { children?: React.ReactNode }) {
  // 错误状态
  const [hasError, setHasError] = useState(false);

  // 错误边界
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[AIPaletteCenter] Error caught:', event.error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // 如果发生错误，显示简化版本
  if (hasError) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-600">色板加载中，请稍后重试</p>
      </div>
    );
  }

  const [activeBrand, setActiveBrand] = useState<BrandType>(() => {
    return OLD_TO_NEW_BRAND[selectedBrand] || selectedBrand as BrandType || 'Mard';
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedCodeSet, setSelectedCodeSet] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInputValue, setSearchInputValue] = useState(''); // 独立的输入值状态
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [useAllColorsMode, setUseAllColorsMode] = useState(true);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const userInteractedRef = useRef(false);

  // ========== 统一的存储键名定义 ==========
  const getStorageKey = {
    customData: (brand: string) => `aiPalette_${brand}_custom`,
    presetData: (brand: string, preset: string) => `aiPalette_${brand}_${preset}`,
    modeFlag: (brand: string) => `aiPalette_${brand}_mode`,
    activePreset: (brand: string) => `aiPalette_${brand}_activePreset`,
  };

  // 🚨 重构保存逻辑：使用 useEffect 监听状态变化并同步到 localStorage
  // 🚨 关键修复：绝对不准删除任何存档！两种模式的数据必须同时共存！
  useEffect(() => {
    if (!activeBrand || selectedCodeSet.size === 0) return;
    const data = JSON.stringify([...selectedCodeSet]);
    
    if (isCustomMode) {
      // 自定义模式：只保存到 custom，不删除预设存档
      localStorage.setItem(getStorageKey.customData(activeBrand), data);
      localStorage.setItem(getStorageKey.modeFlag(activeBrand), 'custom');
      // ❌ 绝对禁止删除预设存档！
    } else if (activePreset) {
      // 预设模式：只保存到当前预设，不删除自定义存档
      localStorage.setItem(getStorageKey.presetData(activeBrand, activePreset), data);
      localStorage.setItem(getStorageKey.activePreset(activeBrand), activePreset);
      localStorage.setItem(getStorageKey.modeFlag(activeBrand), 'preset');
      // ❌ 绝对禁止删除自定义存档！
    }
  }, [selectedCodeSet, isCustomMode, activeBrand, activePreset]);

  // 🚨 初始化逻辑（尊重首页传参）
  // 🚨 修复：使用 ref 追踪初始化状态，避免组件重新创建时导致搜索词被清空
  // 🚨 使用 sessionStorage 追踪初始化状态，避免组件重新挂载时重置
  const initKey = 'aiPaletteCenterInitialized';
  const isAlreadyInitialized = typeof window !== 'undefined' && sessionStorage.getItem(initKey) === 'true';
  
  useEffect(() => {
    if (!isOpen) return;
    
    // 🚨 关键修复：只有在首次真正初始化时才清空搜索词
    if (!isAlreadyInitialized) {
      sessionStorage.setItem(initKey, 'true');
      // 首次初始化时清空搜索词
      setSearchQuery('');
      setSearchInputValue('');
    }
  }, [isOpen, isAlreadyInitialized]);
  
  // 当 isOpen 变化时的初始化逻辑（保持在 useEffect 外部，确保正确执行）
  useEffect(() => {
    if (!isOpen) return;
    
    const groupName = OLD_TO_NEW_BRAND[selectedBrand] || selectedBrand;
    setActiveBrand(groupName as BrandType);
    
    // 🚨 清理所有旧的预设缓存（避免旧数据导致数量翻倍）
    try {
      const presets = getPresetsByGroup(groupName as string);
      presets.forEach(preset => {
        const savedKey = `palette_${groupName}_${preset.brandCode}`;
        const saved = localStorage.getItem(savedKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // 🚨 如果缓存数量超过预设实际数量，说明是旧缓存，清理掉
            if (parsed.length > (preset.colorCount || 0) * 1.1) {
              console.log(`[DEBUG] 清理旧缓存 ${savedKey}: ${parsed.length} > ${preset.colorCount}`);
              localStorage.removeItem(savedKey);
            }
          } catch (e) {
            console.warn('JSON解析失败:', e);
          }
        }
      });
    } catch (e) {
      console.warn('获取预设失败:', e);
    }
    
    // 🚨 逻辑修复：首页明确传了预设 ID 时（如 291色），强制切换到该预设
    if (selectedPresetId && !['custom', '全部'].includes(selectedPresetId)) {
      setActivePreset(selectedPresetId);
      setIsCustomMode(false);
      setUseAllColorsMode(false); // 🚨 修复：选择预设时不用全部选中模式，互斥！
      // 🎯 使用 getColorsByPreset 确保数据经过双重过滤！
      const presetColors = getColorsByPreset(selectedPresetId, groupName as string);
      setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
    } else {
      // 🚨 重构：检查 modeFlag 确定模式
      const mode = localStorage.getItem(`palette_${groupName}_mode`);
      
      if (mode === 'custom') {
        // 🚨 加载自定义选色：优先从 localStorage 读取
        setIsCustomMode(true);
        setUseAllColorsMode(false);
        setActivePreset(null);
        const saved = localStorage.getItem(`palette_${groupName}_custom`);
        if (saved) {
          try { 
            const parsed = JSON.parse(saved);
            console.log(`[DEBUG] localStorage ${groupName}_custom: ${parsed.length}个元素`);
            
            // 🚨 数据验证：如果缓存数量超过 brandColors.length，说明是旧缓存！
            const maxPresetColors = presets.length > 0 
              ? getColorsByPreset(presets[presets.length - 1].brandCode, groupName as string)
              : [];
            
            // 🎯 更严格的验证：检查缓存的色号是否都存在于当前 brandColors 中
            // 如果缓存数量异常（如572 > 286），说明是旧缓存，直接清空
            if (parsed.length > maxPresetColors.length * 1.1) {
              console.log(`[DEBUG] localStorage 缓存异常: ${parsed.length} > ${maxPresetColors.length}，清空旧缓存！`);
              setSelectedCodeSet(new Set(maxPresetColors.map(c => c.code)));
            } else {
              // 正常情况：过滤出有效的色号
              const validCodes = parsed.filter((code: string) => 
                maxPresetColors.some(c => c.code === code || c.code === code.split('_')[0])
              );
              setSelectedCodeSet(new Set(validCodes));
            } 
          } catch (e) {
            console.warn('解析 custom 缓存失败:', e);
            // 清空缓存，使用默认颜色
            const defaultColors = getColorsByPreset(selectedPresetId, groupName as string);
            setSelectedCodeSet(new Set(defaultColors.map(c => c.code)));
          }
        }
      } else {
        // 🚨 预设模式：优先从 localStorage 读取
        // 兼容两种 key：PaletteCenter 自己的和 工作台保存的
        const savedPreset = localStorage.getItem(`palette_${groupName}_activePreset`) 
          || localStorage.getItem('currentPalettePreset');
        if (savedPreset && presets.find(p => p.brandCode === savedPreset)) {
          // 🎯 使用 getColorsByPreset 确保数据经过双重过滤！
          const presetColors = getColorsByPreset(savedPreset, groupName as string);
          if (presetColors.length > 0) {
            setActivePreset(savedPreset);
            setUseAllColorsMode(false); // 🚨 修复：恢复预设时不激活全部选中模式
            setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
          }
        } else {
          // 尝试用 brandName 匹配（如 "Mard-72" -> "Mard_72"）
          const presets = getPresetsByGroup(groupName as string);
          const matchedPreset = presets.find(p => 
            p.brandCode === savedPreset || 
            p.brandName === savedPreset ||
            savedPreset?.includes(p.brandName.replace('Mard-', '').replace('DoDo-', ''))
          );
          if (matchedPreset) {
            // 🎯 使用 getColorsByPreset 确保数据经过双重过滤！
            const presetColors = getColorsByPreset(matchedPreset.brandCode, groupName as string);
            setActivePreset(matchedPreset.brandCode);
            setUseAllColorsMode(false); // 🚨 修复：恢复预设时不激活全部选中模式
            setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
          } else {
            // 默认回落到第一个预设（全部选中模式）
            if (presets.length > 0) {
              const first = presets[0].brandCode;
              setActivePreset(null); // 🚨 修复：全部选中模式不清除预设但不高亮
              setUseAllColorsMode(true);
              setIsCustomMode(false);
              // 🎯 使用 getColorsByPreset 确保数据经过双重过滤！
              const presetColors = getColorsByPreset(first, groupName as string);
              setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
            }
          }
        }
      }
    }
  }, [isOpen, selectedBrand, selectedPresetId]);

  // 🔧 防抖标记：防止多次触发
  const initRef = useRef(false);

  useEffect(() => {
    if (!isOpen || isCustomMode) return;

    // 🔧 防抖：延迟执行，避免快速触发
    if (initRef.current) return;
    initRef.current = true;

    const timer = setTimeout(() => {
      initRef.current = false;

      if (!activePreset) return;

      // 保存当前预设到 localStorage
      localStorage.setItem(`palette_${activeBrand}_activePreset`, activePreset);

      const savedKey = `palette_${activeBrand}_${activePreset}`;
      const saved = localStorage.getItem(savedKey);
      console.log(`[DEBUG] useEffect 检查缓存: savedKey=${savedKey}`);
      if (saved) {
        try {
          const savedSet = JSON.parse(saved) as string[];
          console.log(`[DEBUG] useEffect 从缓存恢复: savedSet.length=${savedSet.length}`);
          setSelectedCodeSet(new Set(savedSet));
          return;
        } catch {
          // 解析失败
        }
      }
      // 🎯 使用 getColorsByPreset 确保数据经过双重过滤！
      const presetColors = getColorsByPreset(activePreset, activeBrand);
      console.log(`[DEBUG] useEffect init: presetColors.length=${presetColors.length}`);
      setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
    }, 50);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeBrand, activePreset, isCustomMode]);

  const currentGroupName = activeBrand;
  const currentPresets = useMemo(() => getPresetsByGroup(currentGroupName), [currentGroupName]);
  const brandColors = useMemo(() => {
    // 🎯 找出当前品牌的最大预设（颜色数量最多的预设）
    const maxPreset = currentPresets.reduce((max, p) => 
      (brandColorsMap[p.brandCode]?.length || 0) > (brandColorsMap[max?.brandCode]?.length || 0) ? p : max
    , currentPresets[0]);
    
    // 🔍 调试日志
    console.log(`[DEBUG] brandColors: isCustomMode=${isCustomMode}, useAllColorsMode=${useAllColorsMode}, activePreset=${activePreset}, maxPreset=${maxPreset?.brandCode}`);
    
    if (isCustomMode) {
      // 自定义选色模式：使用最大预设作为可选范围
      const result = getColorsByPreset(maxPreset?.brandCode || null, currentGroupName);
      console.log(`[DEBUG] brandColors custom: result.length=${result.length}`);
      return result;
    }
    if (useAllColorsMode && activePreset === null) {
      // 全部选中模式：使用最大预设
      const result = getColorsByPreset(maxPreset?.brandCode || null, currentGroupName);
      console.log(`[DEBUG] brandColors all: result.length=${result.length}`);
      return result;
    }
    if (activePreset) {
      const result = getColorsByPreset(activePreset, currentGroupName);
      console.log(`[DEBUG] brandColors preset: result.length=${result.length}`);
      return result;
    }
    const result = getColorsByPreset(maxPreset?.brandCode || null, currentGroupName);
    console.log(`[DEBUG] brandColors default: result.length=${result.length}`);
    return result;
  }, [currentGroupName, activePreset, useAllColorsMode, isCustomMode, currentPresets]);

  // 🔍 调试日志 - 显示最终 brandColors.length
  console.log(`[DEBUG] 最终 brandColors.length=${brandColors.length}`);

  const filteredColors = useMemo(() => {
    console.log('[DEBUG] filteredColors 计算: searchQuery=', JSON.stringify(searchQuery), 'brandColors.length=', brandColors.length);
    if (!searchQuery.trim()) return brandColors;
    const query = searchQuery.toLowerCase().trim();
    const result = brandColors.filter(color => {
      if (color.code.toLowerCase().includes(query)) return true;
      if (color.hex.toLowerCase().includes(query)) return true;
      return false;
    });
    console.log(`[DEBUG] 搜索: query="${query}", filteredColors.length=${result.length}`);
    return result;
  }, [brandColors, searchQuery]);

  const sortedFilteredColors = useMemo(() => {
    return [...filteredColors].sort((a, b) => {
      const pa = parseCodeParts(a.code);
      const pb = parseCodeParts(b.code);
      if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
      return pa.number - pb.number;
    });
  }, [filteredColors]);

  const presetColorCount = brandColors.length;
  const selectedCount = selectedCodeSet.size;
  
  // 🔍 调试日志
  console.log(`[DEBUG] searchQuery="${searchQuery}", sortedFilteredColors.length=${sortedFilteredColors.length}, selectedCount=${selectedCount}`);
  
  const allSelected = selectedCount === presetColorCount && presetColorCount > 0;

  const handleSelectAllVisible = useCallback(() => {
    const next = new Set(selectedCodeSet);
    filteredColors.forEach(color => next.add(color.code));
    setSelectedCodeSet(next);
    userInteractedRef.current = true; // 防止 useEffect 清空搜索词
  }, [selectedCodeSet, filteredColors]);

  const handleSelectAllCurrentPreset = useCallback(() => {
    setSelectedCodeSet(new Set(brandColors.map(c => c.code)));
    setUseAllColorsMode(true);
    userInteractedRef.current = true; // 防止 useEffect 清空搜索词
  }, [brandColors]);

  const handleSelectNone = useCallback(() => {
    setSelectedCodeSet(new Set());
    userInteractedRef.current = true; // 防止 useEffect 清空搜索词
  }, []);

  // ========== 简化 toggleColor：只负责更新 Set，保存由 useEffect 接管 ==========
  const toggleColor = useCallback((code: string) => {
    console.log('[DEBUG] toggleColor: code=', code, 'before selectedCodeSet.size=', selectedCodeSet.size);
    setSelectedCodeSet(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      console.log('[DEBUG] toggleColor after: prev.size=', prev.size, 'next.size=', next.size);
      return next;
    });
    userInteractedRef.current = true;
  }, [selectedCodeSet]);
  
  // 🚨 重构 handleSave：确保最后一次强制同步所有状态到 localStorage
  // 🚨 关键修复：绝对不准删除任何存档！
  const handleSave = useCallback(() => {
    // 强制同步到 localStorage
    if (isCustomMode) {
      localStorage.setItem(getStorageKey.customData(activeBrand), JSON.stringify([...selectedCodeSet]));
      localStorage.setItem(getStorageKey.modeFlag(activeBrand), 'custom');
      // ❌ 绝对禁止删除预设存档！
    } else if (activePreset) {
      localStorage.setItem(getStorageKey.presetData(activeBrand, activePreset), JSON.stringify([...selectedCodeSet]));
      localStorage.setItem(getStorageKey.activePreset(activeBrand), activePreset);
      localStorage.setItem(getStorageKey.modeFlag(activeBrand), 'preset');
      // ❌ 绝对禁止删除自定义存档！
    }
    
    const result: Record<string, [number, number, number]> = {};
    brandColors.forEach(color => {
      if (selectedCodeSet.has(color.code)) {
        result[color.code] = color.rgb;
      }
    });
    onSave(result, activeBrand, isCustomMode ? 'custom' : (activePreset || '全部'));
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandColors, selectedCodeSet, activeBrand, activePreset, isCustomMode, onSave, onClose]);


  if (!isOpen) return null;

  const currentPresetInfo = currentPresets.find(p => p.brandCode === activePreset);
  let presetName = currentPresetInfo?.brandName || activePreset;
  if (isCustomMode) {
    presetName = '自定义';
  } else if (!presetName || presetName === 'null') {
    presetName = '全部';
  }
  const allBrands: BrandType[] = allGroups as BrandType[];

  return (
    <ModalWrapper embedded={embedded} onClose={onClose}>
      <ModalContent embedded={embedded}>
        {/* 标题栏 - 紫色渐变通栏 */}
        <div className={`bg-gradient-to-r ${BRAND_GRADIENTS[activeBrand] || 'from-purple-500 to-purple-600'} px-4 sm:px-6 py-3 sm:py-5 text-white flex-shrink-0`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
              <h2 className="text-base sm:text-xl font-bold">色板中心</h2>
            </div>
            <div className="text-[10px] sm:text-sm text-white/85">
              已选 {selectedCount}/{presetColorCount}
            </div>
            <button onClick={onClose} className="rounded-lg bg-white/15 p-1.5"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* 品牌和预设选择 */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 sm:px-6 py-2 sm:py-4 flex-shrink-0 overflow-y-auto max-h-[35%]">
          <div className="space-y-3">
            {/* 品牌选择 */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">品牌</div>
              <div className="flex flex-wrap gap-2">
                {allBrands.map(brand => {
                  const displayName = NEW_TO_OLD_BRAND[brand] || brand;
                  return (
                    <button
                      key={brand}
                      onClick={() => {
                        // 🚨 重构：不再需要手动保存（useEffect 会自动保存）
                        // 🚨 品牌切换时的加载逻辑：检查 modeFlag 确定加载哪种模式
                        
                        setActiveBrand(brand);
                        
                        // 🎯 检查该品牌的模式标志
                        const mode = localStorage.getItem(`palette_${brand}_mode`);
                        const presets = getPresetsByGroup(brand);
                        
                        if (mode === 'custom') {
                          // 🚨 加载自定义选色：优先从 localStorage 读取
                          const savedCustom = localStorage.getItem(`palette_${brand}_custom`);
                          if (savedCustom) {
                            try {
                              const parsed = JSON.parse(savedCustom);
                              // 🚨 数据验证：过滤出有效的色号
                              const maxPreset = presets.length > 0 ? presets[presets.length - 1] : null;
                              const maxPresetColors = maxPreset ? getColorsByPreset(maxPreset.brandCode, brand) : [];
                              const validCodes = parsed.filter((code: string) => 
                                maxPresetColors.some(c => c.code === code || c.code === code.split('_')[0])
                              );
                              setSelectedCodeSet(new Set(validCodes));
                              setIsCustomMode(true);
                              setUseAllColorsMode(false);
                              setActivePreset(null);
                              return;
                            } catch (e) {
                              console.error('加载自定义选色失败:', e);
                            }
                          }
                          // 如果没有缓存，使用最大预设
                          setIsCustomMode(true);
                          setUseAllColorsMode(false);
                          setActivePreset(null);
                        } else {
                          // 🚨 预设模式：优先从 localStorage 读取
                          const savedPreset = localStorage.getItem(`palette_${brand}_activePreset`);
                          
                          if (savedPreset && presets.find(p => p.brandCode === savedPreset)) {
                            // 加载之前选择的预设
                            const savedColors = localStorage.getItem(`palette_${brand}_${savedPreset}`);
                            setActivePreset(savedPreset);
                            setIsCustomMode(false);
                            setUseAllColorsMode(savedColors ? false : true);
                            if (savedColors) {
                              try {
                                const parsed = JSON.parse(savedColors);
                                // 🚨 数据验证：只恢复属于当前预设的颜色
                                const presetColors = getColorsByPreset(savedPreset, brand);
                                const presetColorCodes = new Set(presetColors.map(c => c.code));
                                const validCodes = parsed.filter((code: string) => 
                                  presetColorCodes.has(code) || presetColorCodes.has(code.split('_')[0])
                                );
                                setSelectedCodeSet(new Set(validCodes));
                                return;
                              } catch (e) {
                                console.error('加载预设选色失败:', e);
                              }
                            }
                          }
                          
                          // 如果都没有，使用最大预设（全部选中模式）- 按颜色数量排序取最多
                          if (presets.length > 0) {
                            const sortedByCount = [...presets].sort((a, b) => b.colorCount - a.colorCount);
                            const maxPreset = sortedByCount[0]; // 取颜色数量最多的预设
                            setActivePreset(maxPreset.brandCode);
                            setIsCustomMode(false);
                            setUseAllColorsMode(true);
                            const presetColors = getColorsByPreset(maxPreset.brandCode, brand);
                            setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
                          } else {
                            setSelectedCodeSet(new Set());
                            setActivePreset(null);
                          }
                        }
                      }}
                      className={`rounded-full px-2 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-semibold transition-all ${
                        activeBrand === brand
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-white text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 预设选择 */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">色板预设</div>
              <div className="flex flex-wrap items-center gap-2 max-h-28 overflow-y-auto pr-2">
                {/* 全部选中按钮 - 选择最大预设 */}
                <button
                  onClick={() => {
                    // 🚨 重构：不再需要手动保存（useEffect 会自动保存）
                    // 🚨 全部选中应该选择最大预设（颜色数量最多的预设），而不是合并所有预设！
                    
                    // 🎯 找到最大预设（颜色数量最多的预设）
                    const presets = currentPresets;
                    if (presets.length > 0) {
                      const maxPreset = presets.reduce((max, p) => 
                        (p.colorCount || 0) > (max.colorCount || 0) ? p : max
                      );
                      const maxColors = getColorsByPreset(maxPreset.brandCode, currentGroupName);
                      console.log(`[DEBUG] 全部选中 click: maxPreset=${maxPreset.brandCode}, maxColors.length=${maxColors.length}`);
                      setSelectedCodeSet(new Set(maxColors.map(c => c.code)));
                      setUseAllColorsMode(true);
                      setIsCustomMode(false);
                      setActivePreset(maxPreset.brandCode); // 保存最大预设作为 activePreset
                      // 设置模式标志（useEffect 会自动保存数据）
                      localStorage.setItem(`palette_${activeBrand}_mode`, 'preset');
                      localStorage.setItem(`palette_${activeBrand}_activePreset`, maxPreset.brandCode);
                      userInteractedRef.current = true;
                    }
                  }}
                  className={`rounded-lg px-2 py-1 text-left transition-all ${
                    useAllColorsMode && !isCustomMode
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
                  }`}
                >
                  <div className="text-[11px] sm:text-sm font-bold">全部选中</div>
                  <div className={`text-[10px] sm:text-[11px] ${useAllColorsMode && !isCustomMode ? 'text-purple-100' : 'text-slate-400'}`}>使用全部颜色</div>
                </button>
                
                {/* 自定义选色按钮 - 基于最大预设 */}
                <button
                  onClick={() => {
                    // 🚨 重构：不再需要手动保存（useEffect 会自动保存）
                    // 🎯 找到最大预设作为基础
                    const presets = currentPresets;
                    const maxPreset = presets.length > 0 
                      ? presets.reduce((max, p) => (p.colorCount || 0) > (max.colorCount || 0) ? p : max)
                      : null;
                    
                    if (maxPreset) {
                      setActivePreset(maxPreset.brandCode);
                    }
                    setIsCustomMode(true);
                    setUseAllColorsMode(false);
                    // 设置模式标志（useEffect 会自动保存数据）
                    localStorage.setItem(`palette_${activeBrand}_mode`, 'custom');
                    
                    const saved = localStorage.getItem(`palette_${activeBrand}_custom`);
                    if (saved) {
                      try {
                        const parsed = JSON.parse(saved);
                        // 🚨 数据验证：过滤出有效的色号
                        const maxPresetColors = maxPreset ? getColorsByPreset(maxPreset.brandCode, activeBrand) : [];
                        if (parsed.length > (maxPresetColors.length || 0) * 1.1) {
                          console.log(`[DEBUG] 自定义选色缓存异常: ${parsed.length} > ${maxPresetColors.length}，清空旧缓存！`);
                          if (maxPreset) {
                            setSelectedCodeSet(new Set(maxPresetColors.map(c => c.code)));
                          }
                        } else {
                          // 正常情况：过滤出有效的色号
                          const validCodes = parsed.filter((code: string) => 
                            maxPresetColors.some(c => c.code === code || c.code === code.split('_')[0])
                          );
                          setSelectedCodeSet(new Set(validCodes));
                        }
                        return;
                      } catch {}
                    }
                    // 使用最大预设的颜色作为基础
                    if (maxPreset) {
                      const allColors = getColorsByPreset(maxPreset.brandCode, activeBrand);
                      setSelectedCodeSet(new Set(allColors.map(c => c.code)));
                    }
                  }}
                  className={`rounded-lg px-2 py-1 text-left border transition-all ${
                    isCustomMode
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-purple-50 border-slate-200'
                  }`}
                >
                  <div className="text-[11px] sm:text-sm font-bold">自定义</div>
                  <div className={`text-[10px] sm:text-[11px] ${isCustomMode ? 'text-purple-100' : 'text-slate-400'}`}>手动选择颜色</div>
                </button>
                
                {/* 预设按钮 */}
                {currentPresets.map(preset => {
                  // 🚨 修复：预设按钮和全部选中互斥，useAllColorsMode时预设不高亮
                  const isActive = !useAllColorsMode && activePreset === preset.brandCode && !isCustomMode;
                  return (
                    <button
                      key={preset.brandCode}
                      onClick={() => {
                        // 🚨 重构：不再需要手动保存（useEffect 会自动保存）
                        
                        // 🚨 加载新预设：优先从 localStorage 读取
                        const savedKey = `palette_${activeBrand}_${preset.brandCode}`;
                        const saved = localStorage.getItem(savedKey);
                        const presetColors = getColorsByPreset(preset.brandCode, currentGroupName);
                        const presetColorCodes = new Set(presetColors.map(c => c.code));
                        
                        if (saved) {
                          try {
                            const parsed = JSON.parse(saved);
                            // 🚨 数据验证：只恢复属于当前预设的颜色，过滤掉无效的颜色码
                            const validCodes = parsed.filter((code: string) => 
                              presetColorCodes.has(code) || presetColorCodes.has(code.split('_')[0])
                            );
                            setSelectedCodeSet(new Set(validCodes));
                          } catch {
                            // 使用 getColorsByPreset 确保数据经过双重过滤！
                            setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
                          }
                        } else {
                          // 使用 getColorsByPreset 确保数据经过双重过滤！
                          setSelectedCodeSet(new Set(presetColors.map(c => c.code)));
                        }
                        
                        // 设置状态
                        setActivePreset(preset.brandCode);
                        setUseAllColorsMode(false); // 🚨 选择预设时不用全部选中模式，互斥！
                        setIsCustomMode(false);
                        // 设置模式标志（useEffect 会自动保存数据）
                        localStorage.setItem(`palette_${activeBrand}_mode`, 'preset');
                        localStorage.setItem(`palette_${activeBrand}_activePreset`, preset.brandCode);
                        userInteractedRef.current = true;
                      }}
                      className={`rounded-lg px-2 py-1 text-left border transition-all whitespace-nowrap ${
                        !useAllColorsMode && activePreset === preset.brandCode && !isCustomMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-slate-700 hover:bg-purple-50 border-slate-200'
                      }`}
                    >
                      <div className="text-[11px] sm:text-sm font-bold">{preset.brandName}</div>
                      <div className={`text-[10px] sm:text-[11px] ${activePreset === preset.brandCode && !isCustomMode ? 'text-purple-100' : 'text-slate-400'}`}>{getColorsByPreset(preset.brandCode, currentGroupName).length} 色</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-sm">
            <span className="font-bold text-slate-700">当前：{NEW_TO_OLD_BRAND[activeBrand] || activeBrand} / {presetName}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-600">可用 <span className="font-bold text-blue-600">{presetColorCount}</span> 色</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-600">{allSelected ? '全部选中' : `已选 <span className="font-bold text-emerald-600">${selectedCount}</span> 色`}</span>
          </div>
        </div>

        {/* 搜索和批量操作 */}
        <div className="border-b border-slate-100 px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-2 sm:left-3 top-1/2 h-3.5 sm:h-4 w-3.5 sm:w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索色号"
                value={searchInputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  console.log('[搜索输入] inputValue:', val, '| stateBefore:', searchInputValue);
                  setSearchInputValue(val);
                  setSearchQuery(val); // 同步更新搜索状态
                }}
                onFocus={() => console.log('[搜索框] focus')}
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 py-1.5 sm:py-2 pl-7 sm:pl-8 pr-2 sm:pr-3 text-[11px] sm:text-sm outline-none transition-all focus:border-purple-400 focus:ring-2 sm:focus:ring-4 focus:ring-purple-100"
              />
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <button
                onClick={handleSelectAllVisible}
                className="rounded-lg sm:rounded-xl bg-emerald-50 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                全选搜索
              </button>
              <button
                onClick={handleSelectAllCurrentPreset}
                className="rounded-lg sm:rounded-xl bg-blue-50 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
              >
                全选色板
              </button>
              <button
                onClick={handleSelectNone}
                className="rounded-lg sm:rounded-xl bg-rose-50 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
              >
                全不选
              </button>
            </div>
          </div>
        </div>

        {/* 颜色网格 */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-4 sm:py-4 md:p-6">
            {console.log('[网格渲染] sortedFilteredColors.length=', sortedFilteredColors.length, 'searchQuery=', JSON.stringify(searchQuery))}
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1 sm:gap-2">
              {sortedFilteredColors.map((color, idx) => {
                if (idx < 3) console.log(`[网格颜色 ${idx}] code=${color.code}, hex=${color.hex}`);
                const selected = selectedCodeSet.has(color.code);
                return (
                  <button
                    key={`${activeBrand}-${activePreset}-${color.code}`}
                    type="button"
                    onClick={() => toggleColor(color.code)}
                    className={`group relative overflow-hidden rounded-lg border-2 p-1 sm:p-2 text-left transition-all hover:scale-[1.03] active:scale-[0.97] ${
                      selected
                        ? 'border-purple-500 bg-white'
                        : 'border-slate-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="mb-1 h-7 sm:h-10 rounded border border-black/10" style={{ backgroundColor: color.hex }} />
                    <div className="truncate text-[8px] sm:text-xs font-bold text-slate-800">{formatCode(color.code)}</div>
                    {selected && (
                      <div className="absolute right-0.5 top-0.5 rounded-full bg-purple-600 p-0.5 text-white shadow sm:right-1 sm:top-1">
                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {sortedFilteredColors.length === 0 && (
              <div className="py-8 sm:py-16 text-center text-slate-400">
                <Search className="mx-auto mb-2 sm:mb-3 h-8 sm:h-10 w-8 sm:w-10 opacity-50" />
                <p>没有找到匹配的颜色</p>
              </div>
            )}
          </div>

          {/* 侧边栏 */}
          <aside className="hidden border-l border-slate-100 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Layers3 className="h-4 w-4" />
              已选预览
            </div>
            <p className="mt-1 text-xs text-slate-500">仅展示前 24 个颜色。</p>
            <div className="mt-4 grid grid-cols-6 gap-2">
              {brandColors.filter(c => selectedCodeSet.has(c.code)).slice(0, 24).map(color => (
                <div
                  key={`preview-${color.code}`}
                  className="h-7 rounded-lg border border-black/10 shadow-sm"
                  title={`${color.code} ${color.hex}`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
            {brandColors.filter(c => selectedCodeSet.has(c.code)).length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                暂未选择颜色
              </div>
            )}
            <div className="mt-6 rounded-2xl bg-white p-4 text-xs text-slate-500 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <Sparkles className="h-4 w-4 text-purple-500" />
                使用说明
              </div>
              <p className="mt-2 leading-relaxed">
                如果不手动删减颜色，系统会使用当前品牌和色板预设下的全部可用色；手动选择后，生成图纸只会在已选颜色里取最近色。
              </p>
            </div>
          </aside>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 border-t border-slate-100 bg-white px-3 sm:px-6 py-2.5 sm:py-4 flex-shrink-0">
          <div className="text-[11px] sm:text-sm text-slate-500">
            将应用：<span className="font-semibold text-slate-800">{NEW_TO_OLD_BRAND[activeBrand] || activeBrand}</span> / <span className="font-semibold text-slate-800">{presetName}</span> / <span className="font-semibold text-purple-600">{selectedCount} 色</span>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="rounded-lg sm:rounded-xl border border-slate-200 bg-white px-3 sm:px-5 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={selectedCount === 0}
              className="rounded-lg sm:rounded-xl bg-purple-600 px-3 sm:px-6 py-1.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              保存并应用
            </button>
          </div>
        </div>
      </ModalContent>
    </ModalWrapper>
  );
}
