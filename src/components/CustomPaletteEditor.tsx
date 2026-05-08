'use client';

import React, { useState, useEffect } from 'react';
import { PaletteColor } from '../utils/pixelation';
import { PaletteSelections, saveSelectedPresetName, loadSelectedPresetName } from '../utils/localStorageUtils';
import { getDisplayColorKey, ColorSystem, getColorKeyByHex, getWorkstationColorSystems } from '../utils/colorSystemUtils';
import colorSystemMapping from '../app/colorSystemMapping.json';
import newColorData from '../app/api/palettes/newColorData.json';

// 从 newColorData 动态生成所有品牌的预设色板
interface PresetPalette {
  name: string;
  count: number;
  mardKeys: string[];
}

function generatePresetPalettes(): PresetPalette[] {
  const presets: PresetPalette[] = [];
  
  newColorData.brands.forEach(brand => {
    const colors = newColorData.colorCards[String(brand.id)] || [];
    if (colors.length > 0) {
      presets.push({
        name: brand.brandName,
        count: colors.length,
        mardKeys: colors.map(c => c.colorCode)
      });
    }
  });
  
  return presets;
}

const MARD_PRESET_PALETTES: PresetPalette[] = generatePresetPalettes();

// 对颜色进行分组的工具函数，按前缀分组
function groupColorsByPrefix(colors: PaletteColor[], selectedColorSystem: ColorSystem): Record<string, PaletteColor[]> {
  const groups: Record<string, PaletteColor[]> = {};
  
  colors.forEach(color => {
    const displayKey = getDisplayColorKey(color.hex, selectedColorSystem);
    
    let prefix: string;
    if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
      // 对于纯数字的色号系统，按数字范围分组
      if (/^\d+$/.test(displayKey)) {
        const num = parseInt(displayKey, 10);
        if (num <= 20) {
          prefix = '1-20';
        } else if (num <= 50) {
          prefix = '21-50';
        } else if (num <= 100) {
          prefix = '51-100';
        } else if (num <= 200) {
          prefix = '101-200';
        } else {
          prefix = '200+';
        }
      } else {
        prefix = '其他';
      }
    } else {
      // 对于有字母前缀的色号系统，按字母前缀分组
      prefix = displayKey.match(/^[A-Z]+/)?.[0] || '其他';
    }
    
    if (!groups[prefix]) {
      groups[prefix] = [];
    }
    groups[prefix].push(color);
  });
  
  // 对每个组内的颜色按键进行排序
  Object.keys(groups).forEach(prefix => {
    groups[prefix].sort((a, b) => {
      const displayKeyA = getDisplayColorKey(a.hex, selectedColorSystem);
      const displayKeyB = getDisplayColorKey(b.hex, selectedColorSystem);
      
      if (selectedColorSystem === '盼盼' || selectedColorSystem === '咪小窝') {
        // 对于纯数字色号，按数字大小排序
        const numA = parseInt(displayKeyA, 10) || 0;
        const numB = parseInt(displayKeyB, 10) || 0;
        return numA - numB;
      } else {
        // 对于有字母前缀的色号，按字母+数字排序
        const numA = parseInt(displayKeyA.replace(/^[A-Z]+/, ''), 10) || 0;
        const numB = parseInt(displayKeyB.replace(/^[A-Z]+/, ''), 10) || 0;
        return numA - numB;
      }
    });
  });
  
  return groups;
}

interface CustomPaletteEditorProps {
  allColors: PaletteColor[];
  currentSelections: PaletteSelections;
  onSelectionChange: (key: string, isSelected: boolean) => void;
  onSaveCustomPalette: () => void;
  onClose: () => void;
  onExportCustomPalette: () => void;
  onImportCustomPalette: () => void;
  selectedColorSystem: ColorSystem;
  onColorSystemChange: (colorSystem: ColorSystem) => void;
}

const CustomPaletteEditor: React.FC<CustomPaletteEditorProps> = ({
  allColors,
  currentSelections,
  onSelectionChange,
  onSaveCustomPalette,
  onClose,
  onExportCustomPalette,
  onImportCustomPalette,
  selectedColorSystem,
  onColorSystemChange,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(() => loadSelectedPresetName());
  
  useEffect(() => {
    const count = Object.values(currentSelections).filter(Boolean).length;
    setSelectedCount(count);
  }, [currentSelections]);
  
  const filteredColors = searchTerm 
    ? allColors.filter(color => {
        const originalKey = color.key.toLowerCase();
        const displayKey = getDisplayColorKey(color.hex, selectedColorSystem).toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        return originalKey.includes(searchLower) || displayKey.includes(searchLower);
      })
    : allColors;
  
  const colorGroups = groupColorsByPrefix(filteredColors, selectedColorSystem);
  
  const toggleGroup = (prefix: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [prefix]: !prev[prefix]
    }));
  };
  
  const toggleAllColors = (selected: boolean) => {
    setSelectedPresetName(null);
    saveSelectedPresetName(null);
    allColors.forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  const toggleGroupColors = (prefix: string, selected: boolean) => {
    setSelectedPresetName(null);
    saveSelectedPresetName(null);
    colorGroups[prefix].forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), selected);
    });
  };
  
  const applyMardPreset = (preset: typeof MARD_PRESET_PALETTES[0]) => {
    setSelectedPresetName(preset.name);
    saveSelectedPresetName(preset.name);
    
    allColors.forEach(color => {
      onSelectionChange(color.hex.toUpperCase(), false);
    });
    
    if (preset.mardKeys.length === 0) {
      allColors.forEach(color => {
        onSelectionChange(color.hex.toUpperCase(), true);
      });
    } else {
      const presetKeySet = new Set(preset.mardKeys);
      allColors.forEach(color => {
        const colorCode = getColorKeyByHex(color.hex.toUpperCase(), selectedColorSystem);
        if (presetKeySet.has(colorCode)) {
          onSelectionChange(color.hex.toUpperCase(), true);
        }
      });
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(246,249,255,0.93),rgba(240,244,252,0.95))] text-slate-800 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
      style={{ minHeight: 0 }}
    >
      <div className="sticky top-0 z-20 border-b border-white/60 bg-white/70 px-3 py-3 backdrop-blur-2xl sm:px-4 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#f8fbff,#eef4ff)] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(59,130,246,0.08)] sm:h-10 sm:w-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-wide text-slate-900 sm:text-base">色板中心</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/60 bg-white/75 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.05)] sm:px-3 sm:text-xs">
              已选 {selectedCount}
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:bg-white hover:text-slate-700"
              aria-label="关闭色板面板"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
        <div className="rounded-[20px] border border-white/65 bg-white/70 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl sm:p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索色号，例如 A01 / 108"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/80 py-2.5 pl-10 pr-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 sm:py-3 sm:pl-11"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16 10.5A5.5 5.5 0 115 10.5a5.5 5.5 0 0111 0z" />
              </svg>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 sm:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485" />
                </svg>
                色号系统
              </label>
              <div className="flex flex-col gap-2">
                {getWorkstationColorSystems().map((system) => (
                  <button
                    key={system.key}
                    onClick={() => {
                      onColorSystemChange(system.key as ColorSystem);
                      setSelectedPresetName(null);
                      saveSelectedPresetName(null);
                    }}
                    className={`rounded-2xl px-1.5 py-2 text-[10px] font-semibold transition-all sm:px-3 sm:py-2.5 sm:text-xs ${
                      selectedColorSystem === system.key
                        ? 'bg-[linear-gradient(180deg,#3b82f6,#7c3aed)] text-white shadow-[0_12px_24px_rgba(99,102,241,0.25)]'
                        : 'border border-white/70 bg-white/75 text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.04)] hover:bg-white'
                    }`}
                  >
                    {system.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleAllColors(true)}
                className="rounded-2xl bg-[linear-gradient(180deg,#22c55e,#16a34a)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(34,197,94,0.22)] transition hover:translate-y-[-1px]"
              >
                全选
              </button>
              <button
                onClick={() => toggleAllColors(false)}
                className="rounded-2xl bg-[linear-gradient(180deg,#fb7185,#e11d48)] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(244,63,94,0.22)] transition hover:translate-y-[-1px]"
              >
                全不选
              </button>
            </div>
          </div>

          {/* 当前品牌的预设色板 */}
          <div className="mt-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 sm:text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2" />
              </svg>
              预设色板
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MARD_PRESET_PALETTES.filter(p => p.name.includes(selectedColorSystem)).map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyMardPreset(preset)}
                  className={`rounded-2xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    selectedPresetName === preset.name
                      ? 'bg-[linear-gradient(180deg,#8b5cf6,#d946ef)] text-white shadow-[0_12px_24px_rgba(168,85,247,0.25)]'
                      : 'border border-white/70 bg-white/75 text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.04)] hover:bg-white'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="rounded-[20px] border border-sky-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.9),rgba(243,248,255,0.82))] p-3 text-[11px] leading-6 text-sky-900 shadow-[0_10px_24px_rgba(59,130,246,0.06)] sm:p-4 sm:text-xs">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10A8 8 0 114 4.874V3a1 1 0 10-2 0v3.5A1.5 1.5 0 003.5 8H7a1 1 0 100-2H4.9A6 6 0 1018 10zm-8-3a1 1 0 00-.867.502l-2 3.5A1 1 0 008 12h1v2a1 1 0 102 0v-3a1 1 0 00-1-1H9.724l1.143-2A1 1 0 0010 7z" clipRule="evenodd" />
            </svg>
            <span>选择你要使用的拼豆色系。可以先选系统和预设，再手动微调色号，最后点击底部“保存并应用”。</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.keys(colorGroups).sort().map(prefix => (
            <button
              key={prefix}
              onClick={() => toggleGroup(prefix)}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                expandedGroups[prefix]
                  ? 'bg-[linear-gradient(180deg,#3b82f6,#2563eb)] text-white shadow-[0_10px_20px_rgba(59,130,246,0.2)]'
                  : 'border border-white/70 bg-white/78 text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.04)] hover:bg-white'
              }`}
            >
              {prefix} <span className="ml-1 opacity-80">{colorGroups[prefix].length}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3 sm:space-y-4">
          {Object.keys(colorGroups)
            .sort()
            .filter(prefix => expandedGroups[prefix])
            .map(prefix => (
              <div
                key={prefix}
                className="overflow-hidden rounded-[24px] border border-white/70 bg-white/72 shadow-[0_14px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
              >
                <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-white/70 bg-white/72 px-3 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(180deg,#3b82f6,#7c3aed)]" />
                    <span className="text-sm font-semibold text-slate-800">{prefix} 系列</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupColors(prefix, true);
                      }}
                      className="rounded-xl bg-[linear-gradient(180deg,#22c55e,#16a34a)] px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(34,197,94,0.2)]"
                    >
                      本组全选
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroupColors(prefix, false);
                      }}
                      className="rounded-xl bg-[linear-gradient(180deg,#fb7185,#e11d48)] px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(244,63,94,0.2)]"
                    >
                      本组全不选
                    </button>
                    <button
                      onClick={() => toggleGroup(prefix)}
                      className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.05)]"
                    >
                      收起
                    </button>
                  </div>
                </div>

                <div className="p-3 sm:p-4">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                    {colorGroups[prefix].map(color => {
                      const checked = !!currentSelections[color.hex.toUpperCase()];
                      return (
                        <label
                          key={color.key}
                          className={`group relative flex cursor-pointer flex-col items-center rounded-[18px] border p-2.5 transition-all sm:p-3 ${
                            checked
                              ? 'border-blue-300 bg-[linear-gradient(180deg,rgba(239,246,255,0.9),rgba(248,250,255,0.92))] shadow-[0_12px_24px_rgba(59,130,246,0.12)]'
                              : 'border-white/70 bg-white/78 shadow-[0_6px_14px_rgba(15,23,42,0.04)] hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedPresetName(null);
                              saveSelectedPresetName(null);
                              onSelectionChange(color.hex.toUpperCase(), e.target.checked);
                            }}
                            className="sr-only"
                          />

                          <div className="absolute right-2 top-2">
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition ${
                                checked
                                  ? 'border-blue-200 bg-blue-500 text-white shadow-[0_8px_18px_rgba(59,130,246,0.24)]'
                                  : 'border-white/80 bg-white/85 text-slate-400'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </div>
                          </div>

                          <div
                            className="h-11 w-11 rounded-xl border-2 border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_rgba(15,23,42,0.08)] sm:h-12 sm:w-12"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="mt-2 w-full text-center text-[11px] font-semibold text-slate-700 sm:text-xs">
                            {getDisplayColorKey(color.hex, selectedColorSystem)}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex-shrink-0 border-t border-white/60 bg-white/72 p-3 backdrop-blur-2xl sm:p-4">
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:bg-white"
          >
            取消
          </button>
          <button
            onClick={onSaveCustomPalette}
            className="flex-1 rounded-2xl bg-[linear-gradient(180deg,#3b82f6,#7c3aed)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(99,102,241,0.22)] transition hover:translate-y-[-1px]"
          >
            保存并应用
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomPaletteEditor;
