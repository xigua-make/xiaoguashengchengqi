'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Pencil,
  Eraser,
  Pipette,
  PaintBucket,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Droplets,
  Layers3,
  Image as ImageIcon,
  Copy,
  Trash2,
  X,
  Minus,
  Square,
  MousePointer2,
  Move,
  Hand,
  Scissors,
} from 'lucide-react';

import {
  GlassShell,
  Panel,
  PrimaryButton,
  GhostButton,
  TinyIconButton,
  SwitchRow,
  ColorBlock,
  brandBlue,
  brandOrange,
} from './ModernUIComponents';

// 工具配置
const tools = [
  { label: '画笔', icon: Pencil },
  { label: '橡皮', icon: Eraser },
  { label: '取色', icon: Pipette },
  { label: '填充', icon: PaintBucket },
  { label: '直线', icon: Minus },
  { label: '矩形', icon: Square },
  { label: '选择', icon: MousePointer2 },
  { label: '移动', icon: Move },
  { label: '拖拽', icon: Hand },
];

// 网格线颜色
const gridLineColors = ['#6B7280', '#FF4D4F', '#4F8DFF', '#32C267', '#8C6BFF', '#FF822E'];

// 组件：处理参数面板
interface ProcessPanelProps {
  onUpload?: (file: File) => void;
  onCreateCanvas?: () => void;
  onRemoveBackground?: () => void;
  width?: number;
  height?: number;
  mergeThreshold?: number;
  mode?: 'cartoon' | 'realistic';
}

export function ProcessPanel({
  onUpload,
  onCreateCanvas,
  onRemoveBackground,
  width,
  height,
  mergeThreshold,
  mode,
}: ProcessPanelProps) {
  const [localWidth, setLocalWidth] = useState(width || 100);
  const [localHeight, setLocalHeight] = useState(height || 100);
  const [localMerge, setLocalMerge] = useState(mergeThreshold || 0);
  const [localMode, setLocalMode] = useState(mode || 'cartoon');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
  };

  return (
    <div className="space-y-4">
      <Panel title="处理参数" icon={<Droplets className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* 上传图片 */}
          <GlassShell className="p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">上传原图</div>
            <label
              htmlFor="upload-source-image"
              className="block cursor-pointer rounded-[20px] border-2 border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 text-center transition hover:border-blue-300 hover:bg-white"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-lg">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div className="text-base font-bold text-slate-800">点击上传图片开始生成</div>
              <div className="mt-1 text-xs text-slate-400">支持 JPG / PNG / WEBP</div>
            </label>
            <input id="upload-source-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
          </GlassShell>

          {/* 空白画布 */}
          {onCreateCanvas && (
            <GlassShell className="p-4">
              <div className="mb-2 text-sm font-semibold text-slate-800">手动空白画板编辑</div>
              <div className="text-xs text-slate-400">创建空白画布，使用画笔自由设计</div>
              <div className="mt-4">
                <PrimaryButton orange full icon={<Layers3 className="h-4 w-4" />} onClick={onCreateCanvas}>
                  创建 / 调整空白画布
                </PrimaryButton>
              </div>
            </GlassShell>
          )}

          {/* 图纸尺寸 */}
          <GlassShell className="p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">图纸尺寸（10-300）</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <input
                  type="number"
                  value={localWidth}
                  onChange={(e) => setLocalWidth(Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
                />
                <div className="mt-2 text-center text-xs text-slate-400">宽</div>
              </div>
              <div className="text-slate-400">×</div>
              <div>
                <input
                  type="number"
                  value={localHeight}
                  onChange={(e) => setLocalHeight(Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
                />
                <div className="mt-2 text-center text-xs text-slate-400">高</div>
              </div>
            </div>
          </GlassShell>

          {/* 颜色合并阈值 */}
          <GlassShell className="p-4">
            <div className="mb-2 text-sm font-semibold text-slate-800">颜色合并阈值（0-100）</div>
            <input
              type="number"
              min={0}
              max={100}
              value={localMerge}
              onChange={(e) => setLocalMerge(Number(e.target.value) || 0)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
            />
          </GlassShell>

          {/* 操作按钮 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton full>应用数字</PrimaryButton>
            {onRemoveBackground && (
              <GhostButton full icon={<ImageIcon className="h-4 w-4" />} onClick={onRemoveBackground}>
                一键去背景
              </GhostButton>
            )}
          </div>

          {/* 处理模式 */}
          <GlassShell className="p-4">
            <div className="mb-2 text-sm font-semibold text-slate-800">处理模式</div>
            <select
              value={localMode}
              onChange={(e) => setLocalMode(e.target.value as 'cartoon' | 'realistic')}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500"
            >
              <option value="cartoon">卡通（主色）</option>
              <option value="realistic">真实（平均色）</option>
            </select>
          </GlassShell>
        </div>
      </Panel>

      <Panel title="快速增强" icon={<Droplets className="h-5 w-5" />}>
        <div className="space-y-3">
          <SwitchRow label="自动净化杂点" desc="弱化边缘杂色和离散像素" />
          <SwitchRow label="高亮主体轮廓" desc="适合人物和商品主体图" />
          <SwitchRow label="显示色号编号" desc="图纸模式更适合打印对照" />
          <SwitchRow label="显示坐标辅助" desc="适合大图手动定位修改" />
        </div>
      </Panel>

      <Panel title="去除杂色" icon={<Grid3X3 className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="text-sm text-slate-500">点击颜色可移除。总计：0 颗</div>
          <div className="rounded-[20px] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 text-center text-sm font-semibold text-slate-300">
            暂无颜色数据
          </div>
        </div>
      </Panel>
    </div>
  );
}

// 组件：工具面板
interface ToolsPanelProps {
  activeTool?: string;
  onToolSelect?: (tool: string) => void;
  brushSize?: number;
  onBrushSizeChange?: (size: number) => void;
  gridInterval?: number;
  onGridIntervalChange?: (interval: number) => void;
}

export function ToolsPanel({
  activeTool = '画笔',
  onToolSelect,
  brushSize = 1,
  onBrushSizeChange,
  gridInterval = 1,
  onGridIntervalChange,
}: ToolsPanelProps) {
  return (
    <div className="space-y-4">
      <Panel
        title="精细调整"
        icon={<Pencil className="h-5 w-5" />}
        right={<span className="text-sm text-slate-400">当前: {activeTool}</span>}
      >
        <div className="mb-4 flex gap-2">
          <TinyIconButton icon={<Undo2 className="h-4 w-4" />} />
          <TinyIconButton icon={<Redo2 className="h-4 w-4 opacity-50" />} />
          <TinyIconButton icon={<ZoomIn className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const selected = activeTool === tool.label;
            return (
              <button
                key={tool.label}
                onClick={() => onToolSelect?.(tool.label)}
                className={cn(
                  'flex h-12 items-center justify-center gap-1.5 rounded-2xl border text-[13px] font-semibold transition',
                  selected ? 'border-transparent text-white' : 'border-white/75 bg-white/78 text-slate-700 hover:bg-white'
                )}
                style={
                  selected
                    ? {
                        background: `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
                        boxShadow: '0 12px 24px rgba(59,130,246,0.22)',
                      }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" />
                {tool.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <GhostButton full>区域擦除</GhostButton>
          <GhostButton full>批量替换</GhostButton>
        </div>
      </Panel>

      <Panel
        title="画笔与形状"
        icon={<Droplets className="h-5 w-5" />}
        right={<span className="text-sm text-slate-400">笔刷 {brushSize}</span>}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>笔刷大小</span>
              <span>{brushSize}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={brushSize}
              onChange={(e) => onBrushSizeChange?.(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['矩形实心', '显示色号', '显示坐标', '水平镜像', '颜色高亮', '文字生成'].map((item) => (
              <GhostButton key={item}>{item}</GhostButton>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="选区与剪贴板" icon={<Copy className="h-5 w-5" />} right={<span className="text-sm text-slate-400">未选择</span>}>
        <div className="grid grid-cols-4 gap-2">
          <GhostButton icon={<Copy className="h-4 w-4" />}>复制</GhostButton>
          <GhostButton icon={<Scissors className="h-4 w-4" />}>剪切</GhostButton>
          <GhostButton>粘贴</GhostButton>
          <GhostButton icon={<Trash2 className="h-4 w-4" />}>清空</GhostButton>
        </div>
        <div className="mt-3">
          <GhostButton full>取消选择</GhostButton>
        </div>
      </Panel>

      <Panel
        title="网格线"
        icon={<Grid3X3 className="h-5 w-5" />}
        right={<GhostButton>显示</GhostButton>}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>网格线间隔（每N格一条线）</span>
              <span>{gridInterval}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={gridInterval}
              onChange={(e) => onGridIntervalChange?.(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">网格线颜色</div>
            <div className="flex flex-wrap gap-3">
              {gridLineColors.map((color) => (
                <button
                  key={color}
                  className="h-8 w-8 rounded-full border-[3px] border-white shadow-lg ring-1 ring-slate-300"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// 工具函数
function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
