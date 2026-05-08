'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sparkles, Search, X } from 'lucide-react';

import {
  GlassShell,
  Panel,
  GhostButton,
  ColorBlock,
  brandBlue,
} from './ModernUIComponents';

// 示例色板数据
const samplePalette = [
  { code: 'A01', color: '#F1E6AE' },
  { code: 'A02', color: '#F4EDC2' },
  { code: 'A03', color: '#EFE76E' },
  { code: 'A04', color: '#F2DF4B' },
  { code: 'A05', color: '#EAC93E' },
  { code: 'A06', color: '#F0A446' },
  { code: 'A07', color: '#F58B43' },
  { code: 'A08', color: '#F2DA58' },
  { code: 'A09', color: '#F4A15B' },
  { code: 'A10', color: '#F37F35' },
  { code: 'A11', color: '#EED181' },
  { code: 'A12', color: '#EF9C73' },
  { code: 'A13', color: '#EDBA56' },
  { code: 'A14', color: '#F65545' },
  { code: 'A15', color: '#F0E86A' },
  { code: 'A16', color: '#DDE56D' },
  { code: 'A17', color: '#EFD86C' },
  { code: 'A18', color: '#EFB671' },
  { code: 'A19', color: '#F47774' },
  { code: 'A20', color: '#F1C85E' },
];

// 替换色板数据
const replacePalette = [
  { code: 'T01', color: '#FFFFFF', dark: false },
  { code: 'P21', color: '#E0B5B6', dark: false },
  { code: 'H16', color: '#1F1720', dark: true },
  { code: 'D16', color: '#D7DCE6', dark: false },
  { code: 'A13', color: '#F0BB63', dark: false },
  { code: 'F20', color: '#C78E94', dark: true },
  { code: 'H03', color: '#B6B1B9', dark: false },
  { code: 'H06', color: '#23212A', dark: true },
  { code: 'F11', color: '#682426', dark: true },
  { code: 'M08', color: '#B78588', dark: true },
];

// 组件：色板面板
interface PalettePanelProps {
  colors?: { code: string; color: string; dark?: boolean }[];
  replaceColors?: { code: string; color: string; dark?: boolean }[];
  onColorSelect?: (code: string, color: string) => void;
  onReplaceColor?: (code: string, color: string) => void;
  showSearch?: boolean;
}

export function PalettePanel({
  colors = samplePalette,
  replaceColors = replacePalette,
  onColorSelect,
  onReplaceColor,
  showSearch = true,
}: PalettePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const filteredColors = colors.filter((item) =>
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleColorClick = (code: string, color: string, isReplace = false) => {
    setSelectedColor(code);
    if (isReplace && onReplaceColor) {
      onReplaceColor(code, color);
    } else if (onColorSelect) {
      onColorSelect(code, color);
    }
  };

  return (
    <div className="space-y-4">
      {/* 完整色板 */}
      <Panel title="画笔颜色选择" icon={<Palette className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* 标题 */}
          <div className="rounded-[20px] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-3 text-center text-[17px] font-bold text-slate-800">
            完整色板（{colors.length}）
          </div>

          {/* 搜索框 */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索色号（如 A01, B02）"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* 色板网格 */}
          <div className="grid max-h-[300px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
            {filteredColors.map((item) => (
              <ColorBlock
                key={item.code}
                code={item.code}
                color={item.color}
                dark={item.dark}
                active={selectedColor === item.code}
                onClick={() => handleColorClick(item.code, item.color)}
              />
            ))}
          </div>
        </div>
      </Panel>

      {/* 替换杂色 */}
      <Panel title="替换杂色" icon={<Sparkles className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* 说明 */}
          <div className="rounded-[20px] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-3 text-center text-[15px] font-bold text-slate-700">
            点击颜色替换为想要的颜色
          </div>

          {/* 替换色板网格 */}
          <div className="grid max-h-[280px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
            {replaceColors.map((item) => (
              <ColorBlock
                key={item.code}
                code={item.code}
                color={item.color}
                dark={item.dark}
                active={selectedColor === item.code}
                onClick={() => handleColorClick(item.code, item.color, true)}
              />
            ))}
          </div>

          {/* 恢复按钮 */}
          <GhostButton full>一键恢复（撤销所有颜色更换）</GhostButton>
        </div>
      </Panel>
    </div>
  );
}

// 组件：紧凑色板（用于工具栏）
interface CompactPaletteProps {
  colors?: { code: string; color: string }[];
  selectedColor?: string;
  onSelect?: (code: string, color: string) => void;
  maxDisplay?: number;
}

export function CompactPalette({
  colors = samplePalette,
  selectedColor,
  onSelect,
  maxDisplay = 12,
}: CompactPaletteProps) {
  const displayColors = colors.slice(0, maxDisplay);

  return (
    <GlassShell className="p-3">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {displayColors.map((item) => (
          <button
            key={item.code}
            onClick={() => onSelect?.(item.code, item.color)}
            className={cn(
              'flex h-10 w-full items-center justify-center rounded-xl text-[11px] font-bold transition hover:-translate-y-0.5',
              selectedColor === item.code && 'ring-2 ring-offset-1 ring-blue-500'
            )}
            style={{
              backgroundColor: item.color,
              color: '#111827',
            }}
          >
            {item.code}
          </button>
        ))}
      </div>
      {colors.length > maxDisplay && (
        <div className="mt-2 text-center text-xs text-slate-500">
          +{colors.length - maxDisplay} 更多颜色
        </div>
      )}
    </GlassShell>
  );
}

// 工具函数
function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
