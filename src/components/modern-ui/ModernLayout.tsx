'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  SlidersHorizontal,
  Palette,
  Pencil,
  Upload,
  Download,
  Import,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Droplets,
  Layers3,
  Image as ImageIcon,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import {
  GlassShell,
  Panel,
  PrimaryButton,
  GhostButton,
  TinyIconButton,
  StatChip,
  SwitchRow,
  brandBlue,
  brandOrange,
} from './ModernUIComponents';

// 类型定义
type MobileTab = 'process' | 'tools' | 'palette' | null;

// 组件：现代化布局容器
interface ModernLayoutProps {
  children: React.ReactNode;
  leftPanel?: React.ReactNode;
  rightPanel?: React.ReactNode;
  header?: React.ReactNode;
}

export function ModernLayout({ children, leftPanel, rightPanel, header }: ModernLayoutProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 顶部导航栏 */}
      {header && (
        <header className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{header}</div>
        </header>
      )}

      {/* 主内容区域 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="gap-6 lg:grid lg:grid-cols-12">
          {/* 左侧面板 */}
          {leftPanel && (
            <div className="lg:col-span-4 lg:order-1">
              <div className="space-y-4">{leftPanel}</div>
            </div>
          )}

          {/* 中央内容区域 */}
          <div className="lg:col-span-8 lg:order-2">{children}</div>

          {/* 右侧面板 */}
          {rightPanel && (
            <div className="lg:col-span-12 lg:order-3 mt-4 lg:mt-0">
              <div className="space-y-4">{rightPanel}</div>
            </div>
          )}
        </div>
      </main>

      {/* 移动端底部导航 */}
      <AnimatePresence>
        {mobileTab && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-white/70 bg-white/90 backdrop-blur-xl lg:hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">
                    {mobileTab === 'process' && '处理参数'}
                    {mobileTab === 'tools' && '精细工具'}
                    {mobileTab === 'palette' && '色板选择'}
                  </span>
                </div>
                <button
                  onClick={() => setMobileTab(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {mobileTab === 'process' && (
                  <div>
                    {/* 处理参数内容将在这里渲染 */}
                    <Panel title="处理参数" icon={<SlidersHorizontal className="h-5 w-5" />}>
                      <div className="space-y-4">
                        <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
                          <div className="text-center text-sm text-slate-500">
                            处理参数内容将在这里显示
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                )}
                {mobileTab === 'tools' && (
                  <div>
                    <Panel title="精细工具" icon={<Pencil className="h-5 w-5" />}>
                      <div className="space-y-4">
                        <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
                          <div className="text-center text-sm text-slate-500">
                            精细工具内容将在这里显示
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                )}
                {mobileTab === 'palette' && (
                  <div>
                    <Panel title="色板选择" icon={<Palette className="h-5 w-5" />}>
                      <div className="space-y-4">
                        <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
                          <div className="text-center text-sm text-slate-500">
                            色板选择内容将在这里显示
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 组件：现代化顶部导航栏
interface ModernHeaderProps {
  title?: string;
  subtitle?: string;
  onImport?: () => void;
  onDownload?: () => void;
  onExport?: () => void;
}

export function ModernHeader({
  title = '小瓜拼豆底稿生成器',
  subtitle,
  onImport,
  onDownload,
  onExport,
}: ModernHeaderProps) {
  return (
    <div className="flex h-16 items-center justify-between gap-4">
      {/* 品牌标识 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      {/* 功能按钮 */}
      <div className="flex items-center gap-2">
        <GhostButton icon={<Import className="h-4 w-4" />} onClick={onImport}>
          导入
        </GhostButton>
        <GhostButton icon={<Download className="h-4 w-4" />} onClick={onDownload}>
          下载
        </GhostButton>
      </div>
    </div>
  );
}

// 组件：现代化上传区域
interface ModernUploadAreaProps {
  onUpload: (file: File) => void;
  onCreateCanvas?: () => void;
}

export function ModernUploadArea({ onUpload, onCreateCanvas }: ModernUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-4">
      {/* 上传图片 */}
      <GlassShell className={cn('p-6', isDragging && 'ring-2 ring-blue-500')}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative"
        >
          <label
            htmlFor="upload-image"
            className={cn(
              'block cursor-pointer rounded-[20px] border-2 border-dashed p-8 text-center transition',
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-gradient-to-b from-white to-slate-50 hover:border-blue-300 hover:bg-white'
            )}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-lg">
              <Upload className="h-8 w-8" />
            </div>
            <div className="text-lg font-bold text-slate-900">上传图片开始生成</div>
            <div className="mt-2 text-sm text-slate-500">
              支持 JPG / PNG / WEBP，点击或拖拽到画布
            </div>
          </label>
          <input
            id="upload-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </GlassShell>

      {/* 创建空白画布 */}
      {onCreateCanvas && (
        <GlassShell className="p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">手动空白画板编辑</div>
              <div className="text-sm text-slate-500">创建空白画布，使用画笔自由设计</div>
            </div>
          </div>
          <PrimaryButton orange full onClick={onCreateCanvas}>
            创建 / 调整空白画布
          </PrimaryButton>
        </GlassShell>
      )}
    </div>
  );
}

// 组件：现代化画布容器
interface ModernCanvasContainerProps {
  children: React.ReactNode;
  stats?: {
    gridSize?: string;
    paletteSize?: string;
    totalBeads?: string;
  };
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  showStats?: boolean;
}

export function ModernCanvasContainer({
  children,
  stats,
  onZoomIn,
  onZoomOut,
  showStats = true,
}: ModernCanvasContainerProps) {
  return (
    <GlassShell className="p-3 sm:p-5">
      {/* 统计信息栏 */}
      {showStats && stats && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {stats.gridSize && <StatChip>{stats.gridSize} 网格</StatChip>}
            {stats.paletteSize && <StatChip>{stats.paletteSize} 色板</StatChip>}
            {stats.totalBeads && <StatChip>总计 {stats.totalBeads} 颗</StatChip>}
          </div>
          <div className="flex items-center gap-2">
            <TinyIconButton icon={<ZoomOut className="h-4 w-4" />} onClick={onZoomOut} />
            <TinyIconButton icon={<ZoomIn className="h-4 w-4" />} onClick={onZoomIn} />
          </div>
        </div>
      )}

      {/* 画布区域 */}
      <div className="flex items-start justify-center overflow-auto rounded-[24px] border border-slate-200/70 bg-[#f5f6f8] p-4 sm:p-8">
        {children}
      </div>
    </GlassShell>
  );
}

// 工具函数
function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
