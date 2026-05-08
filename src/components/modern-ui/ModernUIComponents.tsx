'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Import,
  Sparkles,
  Search,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Palette,
  SlidersHorizontal,
  Layers3,
  Pencil,
  Eraser,
  Pipette,
  PaintBucket,
  Minus,
  Square,
  MousePointer2,
  Move,
  Hand,
  Copy,
  Scissors,
  Trash2,
  Image as ImageIcon,
  Droplets,
  Eye,
  Upload,
  X,
} from 'lucide-react';

// 品牌颜色
const brandBlue = '#3B82F6';
const brandOrange = '#FF8A1F';

// 工具函数：合并类名
function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// 组件：毛玻璃外壳
interface GlassShellProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassShell({ children, className = '' }: GlassShellProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/70 bg-white/72 shadow-[0_18px_55px_rgba(30,41,59,0.08)] backdrop-blur-2xl',
        className
      )}
    >
      {children}
    </div>
  );
}

// 组件：面板容器
interface PanelProps {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Panel({
  title,
  icon,
  right,
  children,
  className = '',
}: PanelProps) {
  return (
    <GlassShell className={cn('p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#f8fbff,#eef3fb)] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              {icon}
            </div>
          ) : null}
          <div className="text-[17px] font-bold tracking-tight text-slate-900">{title}</div>
        </div>
        {right ? <div className="text-sm text-slate-400">{right}</div> : null}
      </div>
      {children}
    </GlassShell>
  );
}

// 组件：主按钮
interface PrimaryButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  orange?: boolean;
  full?: boolean;
  onClick?: () => void;
}

export function PrimaryButton({
  children,
  icon,
  orange = false,
  full = false,
  onClick,
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition hover:brightness-[0.98]',
        full && 'w-full'
      )}
      style={{
        background: orange
          ? `linear-gradient(180deg, ${brandOrange}, #ff7400)`
          : `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
        boxShadow: orange
          ? '0 12px 24px rgba(255,138,31,0.26)'
          : '0 12px 24px rgba(59,130,246,0.24)',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

// 组件：幽灵按钮（次要按钮）
interface GhostButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  full?: boolean;
  onClick?: () => void;
}

export function GhostButton({
  children,
  icon,
  full = false,
  onClick,
}: GhostButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/75 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(30,41,59,0.06)] transition hover:bg-white',
        full && 'w-full'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// 组件：小型图标按钮
interface TinyIconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
}

export function TinyIconButton({ icon, onClick }: TinyIconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/75 bg-white/80 text-slate-500 shadow-[0_8px_18px_rgba(30,41,59,0.06)] transition hover:bg-white"
    >
      {icon}
    </button>
  );
}

// 组件：统计标签
export function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[0_6px_14px_rgba(30,41,59,0.05)]">
      {children}
    </div>
  );
}

// 组件：颜色块
interface ColorBlockProps {
  code: string;
  color: string;
  dark?: boolean;
  active?: boolean;
  onClick?: () => void;
}

export function ColorBlock({
  code,
  color,
  dark = false,
  active = false,
  onClick,
}: ColorBlockProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center rounded-2xl text-[12px] font-bold transition hover:-translate-y-[1px]',
        active && 'ring-2 ring-offset-2 ring-blue-500 ring-offset-white/70'
      )}
      style={{
        backgroundColor: color,
        color: dark ? '#FFFFFF' : '#111827',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      {code}
    </button>
  );
}

// 组件：开关行
interface SwitchRowProps {
  label: string;
  desc: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export function SwitchRow({
  label,
  desc,
  checked = false,
  onChange,
}: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <button
        onClick={() => onChange?.(!checked)}
        className={cn('flex h-7 w-12 items-center rounded-full p-1 transition', checked ? 'bg-blue-500' : 'bg-slate-200')}
      >
        <div
          className={cn(
            'h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

// 导出颜色常量
export { brandBlue, brandOrange };
