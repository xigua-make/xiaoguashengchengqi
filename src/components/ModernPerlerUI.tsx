'use client';

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";

// 类型定义
type MobileTab = "process" | "tools" | "palette" | null;
type ViewMode = "preprocess" | "workspace" | "refine";

// 颜色常量
const brandBlue = "#3B82F6";
const brandOrange = "#FF8A1F";

// 色板数据
const palette = [
  { code: "A01", color: "#F1E6AE" },
  { code: "A02", color: "#F4EDC2" },
  { code: "A03", color: "#EFE76E" },
  { code: "A04", color: "#F2DF4B" },
  { code: "A05", color: "#EAC93E" },
  { code: "A06", color: "#F0A446" },
  { code: "A07", color: "#F58B43" },
  { code: "A08", color: "#F2DA58" },
  { code: "A09", color: "#F4A15B" },
  { code: "A10", color: "#F37F35" },
  { code: "A11", color: "#EED181" },
  { code: "A12", color: "#EF9C73" },
  { code: "A13", color: "#EDBA56" },
  { code: "A14", color: "#F65545" },
  { code: "A15", color: "#F0E86A" },
  { code: "A16", color: "#DDE56D" },
  { code: "A17", color: "#EFD86C" },
  { code: "A18", color: "#EFB671" },
  { code: "A19", color: "#F47774" },
  { code: "A20", color: "#F1C85E" },
  { code: "A21", color: "#EED987" },
  { code: "A22", color: "#E5E166" },
  { code: "A23", color: "#D8BDAE" },
  { code: "A24", color: "#E3DE83" },
  { code: "A25", color: "#E5C471" },
  { code: "A26", color: "#F0C52D" },
  { code: "B01", color: "#CEE82F" },
  { code: "B02", color: "#39D530" },
  { code: "B03", color: "#8DE370" },
  { code: "B04", color: "#47C73E" },
  { code: "B05", color: "#43C89A" },
  { code: "B06", color: "#86DEC6" },
  { code: "C01", color: "#8CBEE8" },
  { code: "C02", color: "#5E8EF7" },
  { code: "C03", color: "#8E72F2" },
  { code: "D01", color: "#F1D1C5" },
  { code: "D02", color: "#D8DCE6" },
  { code: "D03", color: "#B7B1B8" },
  { code: "E01", color: "#825C57" },
  { code: "E02", color: "#1F1720" },
];

const replacePalette = [
  { code: "T01", color: "#FFFFFF", dark: false },
  { code: "P21", color: "#E0B5B6", dark: false },
  { code: "H16", color: "#1F1720", dark: true },
  { code: "D16", color: "#D7DCE6", dark: false },
  { code: "A13", color: "#F0BB63", dark: false },
  { code: "F20", color: "#C78E94", dark: true },
  { code: "H03", color: "#B6B1B9", dark: false },
  { code: "H06", color: "#23212A", dark: true },
  { code: "F11", color: "#682426", dark: true },
  { code: "M08", color: "#B78588", dark: true },
  { code: "R13", color: "#665B57", dark: true },
  { code: "G09", color: "#DDAE79", dark: false },
  { code: "H15", color: "#BEC9C9", dark: false },
  { code: "H22", color: "#DCE4E9", dark: false },
  { code: "M15", color: "#A4A8A6", dark: true },
  { code: "G10", color: "#D48D2B", dark: true },
  { code: "M13", color: "#C88C59", dark: true },
  { code: "G17", color: "#835D58", dark: true },
  { code: "G21", color: "#B07A4B", dark: true },
  { code: "G12", color: "#EFBF87", dark: false },
  { code: "E11", color: "#EFD1C6", dark: false },
  { code: "R22", color: "#6C2B22", dark: true },
  { code: "P23", color: "#AE656E", dark: true },
  { code: "E22", color: "#7C5C7A", dark: true },
];

const tools = [
  { label: "画笔", icon: Pencil },
  { label: "橡皮", icon: Eraser },
  { label: "取色", icon: Pipette },
  { label: "填充", icon: PaintBucket },
  { label: "直线", icon: Minus },
  { label: "矩形", icon: Square },
  { label: "选择", icon: MousePointer2 },
  { label: "移动", icon: Move },
  { label: "拖拽", icon: Hand },
];

const gridLineColors = ["#6B7280", "#FF4D4F", "#4F8DFF", "#32C267", "#8C6BFF", "#FF822E"];
const presets = ["卡通", "真实"];

// 工具函数
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// 基础组件
interface GlassShellProps {
  children: React.ReactNode;
  className?: string;
}

function GlassShell({ children, className = "" }: GlassShellProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/70 bg-white/72 shadow-[0_18px_55px_rgba(30,41,59,0.08)] backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

interface PanelProps {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Panel({
  title,
  icon,
  right,
  children,
  className = "",
}: PanelProps) {
  return (
    <GlassShell className={cn("p-4 sm:p-5", className)}>
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

interface PrimaryButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  orange?: boolean;
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function PrimaryButton({
  children,
  icon,
  orange = false,
  full = false,
  onClick,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition hover:brightness-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        full && "w-full"
      )}
      style={{
        background: orange
          ? `linear-gradient(180deg, ${brandOrange}, #ff7400)`
          : `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
        boxShadow: orange
          ? "0 12px 24px rgba(255,138,31,0.26)"
          : "0 12px 24px rgba(59,130,246,0.24)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

interface GhostButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function GhostButton({
  children,
  icon,
  full = false,
  onClick,
  disabled = false,
}: GhostButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/75 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(30,41,59,0.06)] transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed",
        full && "w-full"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

interface TinyIconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function TinyIconButton({ icon, onClick, disabled = false }: TinyIconButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/75 bg-white/80 text-slate-500 shadow-[0_8px_18px_rgba(30,41,59,0.06)] transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}

interface StatChipProps {
  children: React.ReactNode;
}

function StatChip({ children }: StatChipProps) {
  return (
    <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[0_6px_14px_rgba(30,41,59,0.05)]">
      {children}
    </div>
  );
}

interface ColorBlockProps {
  code: string;
  color: string;
  dark?: boolean;
  active?: boolean;
  onClick?: () => void;
}

function ColorBlock({
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
        "flex h-11 items-center justify-center rounded-2xl text-[12px] font-bold transition hover:-translate-y-[1px]",
        active && "ring-2 ring-offset-2 ring-blue-500 ring-offset-white/70"
      )}
      style={{
        backgroundColor: color,
        color: dark ? "#FFFFFF" : "#111827",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      {code}
    </button>
  );
}

interface SwitchRowProps {
  label: string;
  desc: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

function SwitchRow({ label, desc, checked = false, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
      <div>
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <div
        onClick={() => onChange?.(!checked)}
        className={cn("flex h-7 w-12 cursor-pointer items-center rounded-full p-1 transition", checked ? "bg-blue-500" : "bg-slate-200")}
      >
        <div className={cn("h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0")} />
      </div>
    </div>
  );
}

interface MobileDockButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function MobileDockButton({
  active,
  icon,
  label,
  onClick,
}: MobileDockButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition",
        active ? "text-white" : "bg-white/72 text-slate-600"
      )}
      style={
        active
          ? {
              background: `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
              boxShadow: "0 12px 24px rgba(59,130,246,0.22)",
            }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}

// 画布预览组件
interface CanvasPreviewProps {
  mobile?: boolean;
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
}

function CanvasPreview({
  mobile = false,
  title = "",
  description = "",
  actionButton = null,
}: CanvasPreviewProps) {
  const cells = useMemo(
    () =>
      Array.from({ length: 92 * 92 }, (_, i) => {
        const x = i % 92;
        const y = Math.floor(i / 92);
        if (y < 16) return "#FAFBFD";
        if ((x > 27 && x < 64 && y > 37 && y < 59) || (x > 16 && x < 25 && y > 52 && y < 68)) return "#F0C456";
        if ((x > 21 && x < 34 && y > 37 && y < 82) || (x > 59 && x < 74 && y > 46 && y < 86)) return "#171417";
        if ((x > 33 && x < 60 && y > 34 && y < 85) || (x > 6 && x < 22 && y > 66 && y < 92) || (x > 71 && x < 88 && y > 66 && y < 92)) return "#F5CDC5";
        if ((x > 33 && x < 56 && y > 66 && y < 74) || (x > 37 && x < 56 && y > 78 && y < 83)) return "#EEF2F7";
        if ((x > 36 && x < 49 && y > 38 && y < 47) || (x > 36 && x < 49 && y > 56 && y < 66)) return "#72433A";
        if (((x + y) % 23 === 0 || (x * 3 + y) % 41 === 0) && y > 18 && y < 60) return "#A1A1AA";
        return "#FFFFFF";
      }),
    []
  );

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(243,246,252,0.9))] p-3 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
      {(title || description) && (
        <div className="mb-4 flex flex-col gap-1">
          {title && <div className="text-[18px] font-bold tracking-tight text-slate-900">{title}</div>}
          {description && <div className="text-sm text-slate-400">{description}</div>}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatChip>100 × 100 网格</StatChip>
          <StatChip>291 色板</StatChip>
          <StatChip>总计 10000 颗</StatChip>
        </div>
        <div className="flex items-center gap-2">
          <TinyIconButton icon={<ZoomOut className="h-4 w-4" />} />
          <TinyIconButton icon={<ZoomIn className="h-4 w-4" />} />
        </div>
      </div>

      <div
        className={cn(
          "flex items-start justify-center overflow-auto rounded-[24px] border border-slate-200/70 bg-[#f5f6f8] p-4 sm:p-8",
          mobile ? "h-[calc(100vh-250px)] min-h-[430px]" : "h-[420px] sm:h-[520px] lg:h-[620px] xl:h-[720px]"
        )}
      >
        <div
          className="grid shrink-0 border border-slate-300/80 bg-white shadow-[0_20px_46px_rgba(15,23,42,0.08)]"
          style={{
            gridTemplateColumns: "repeat(92, minmax(0, 7px))",
            lineHeight: 0,
            transform: "translateZ(0)",
          }}
        >
          {cells.map((c, i) => (
            <div
              key={i}
              className="h-[6px] w-[6px] border-r border-b border-slate-300/80 sm:h-[7px] sm:w-[7px]"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {!mobile ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center sm:bottom-5">
          <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/86 px-4 py-2 text-xs font-semibold text-slate-600 shadow-[0_10px_24px_rgba(30,41,59,0.08)] backdrop-blur-xl">
            <Eye className="h-4 w-4" /> 当前为综合工作台预览，可切到预处理 / 精修分组继续调整
          </div>
        </div>
      ) : null}
    </div>
  );
}

// 处理参数面板
interface ProcessSectionProps {
  width: number;
  setWidth: (value: number) => void;
  height: number;
  setHeight: (value: number) => void;
  merge: number;
  setMerge: (value: number) => void;
  preset: string;
  setPreset: (value: string) => void;
  onUpload?: () => void;
  onCreateBlank?: () => void;
  onApplyNumbers?: () => void;
  onRemoveBackground?: () => void;
  onGenerate?: () => void;
}

function ProcessSection({
  width,
  setWidth,
  height,
  setHeight,
  merge,
  setMerge,
  preset,
  setPreset,
  onUpload,
  onCreateBlank,
  onApplyNumbers,
  onRemoveBackground,
  onGenerate,
}: ProcessSectionProps) {
  return (
    <div className="space-y-4">
      <Panel title="处理参数" icon={<SlidersHorizontal className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
            <div className="mb-3 text-sm font-semibold text-slate-800">上传原图</div>
            <label
              htmlFor="upload-source-image"
              className="block cursor-pointer rounded-[20px] border-2 border-dashed border-slate-200 bg-[linear-gradient(180deg,#fbfcfe,#f4f7fb)] p-6 text-center transition hover:border-blue-300 hover:bg-white"
              onClick={(e) => {
                if (onUpload) {
                  e.preventDefault();
                  onUpload();
                }
              }}
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-[0_10px_20px_rgba(30,41,59,0.08)]">
                <Upload className="h-6 w-6" />
              </div>
              <div className="text-base font-bold text-slate-800">点击上传图片开始生成</div>
              <div className="mt-1 text-xs text-slate-400">支持 JPG / PNG / WEBP，点击或拖拽到画布</div>
            </label>
            <input id="upload-source-image" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" />
          </div>

          <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
            <div className="mb-2 text-sm font-semibold text-slate-800">手动空白画板编辑</div>
            <div className="text-xs text-slate-400">创建空白画布，使用画笔自由设计</div>
            <div className="mt-4">
              <PrimaryButton orange full icon={<Layers3 className="h-4 w-4" />} onClick={onCreateBlank}>
                创建 / 调整空白画布
              </PrimaryButton>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
            <div className="mb-3 text-sm font-semibold text-slate-800">图纸尺寸（10-300）</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                />
                <div className="mt-2 text-center text-xs text-slate-400">宽</div>
              </div>
              <div className="text-slate-400">×</div>
              <div>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value) || 0)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                />
                <div className="mt-2 text-center text-xs text-slate-400">高</div>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
            <div className="mb-2 text-sm font-semibold text-slate-800">颜色合并阈值（0-100）</div>
            <input
              type="number"
              min={0}
              max={100}
              value={merge}
              onChange={(e) => setMerge(Number(e.target.value) || 0)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PrimaryButton full onClick={onApplyNumbers}>应用数字</PrimaryButton>
            <GhostButton full icon={<ImageIcon className="h-4 w-4" />} onClick={onRemoveBackground}>
              一键去背景
            </GhostButton>
          </div>

          <div className="rounded-[22px] border border-white/75 bg-white/72 p-4 shadow-[0_8px_18px_rgba(30,41,59,0.04)]">
            <div className="mb-2 text-sm font-semibold text-slate-800">处理模式</div>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
            >
              {presets.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      <Panel title="快速增强" icon={<Sparkles className="h-5 w-5" />}>
        <div className="space-y-3">
          <SwitchRow label="自动净化杂点" desc="弱化边缘杂色和离散像素" checked />
          <SwitchRow label="高亮主体轮廓" desc="适合人物和商品主体图" checked />
          <SwitchRow label="显示色号编号" desc="图纸模式更适合打印对照" />
          <SwitchRow label="显示坐标辅助" desc="适合大图手动定位修改" />
        </div>
      </Panel>

      <Panel title="去除杂色" icon={<Droplets className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="text-sm text-slate-500">点击颜色可移除。总计：0 颗</div>
          <div className="rounded-[20px] bg-[linear-gradient(180deg,#f7f9fd,#eef2f8)] px-4 py-8 text-center text-sm font-semibold text-slate-300">
            暂无颜色数据
          </div>
        </div>
      </Panel>
    </div>
  );
}

// 工具面板
interface ToolSectionProps {
  activeTool: string;
  setActiveTool: (value: string) => void;
  brushSize: number;
  setBrushSize: (value: number) => void;
  gridInterval: number;
  setGridInterval: (value: number) => void;
}

function ToolSection({
  activeTool,
  setActiveTool,
  brushSize,
  setBrushSize,
  gridInterval,
  setGridInterval,
}: ToolSectionProps) {
  return (
    <div className="space-y-4">
      <Panel title="精细调整" icon={<Pencil className="h-5 w-5" />} right={<span>当前: {activeTool}</span>}>
        <div className="mb-4 flex gap-2">
          <TinyIconButton icon={<Undo2 className="h-4 w-4" />} />
          <TinyIconButton icon={<Redo2 className="h-4 w-4" />} />
          <TinyIconButton icon={<Search className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const selected = activeTool === tool.label;
            return (
              <button
                key={tool.label}
                onClick={() => setActiveTool(tool.label)}
                className={cn(
                  "flex h-12 items-center justify-center gap-1.5 rounded-2xl border text-[13px] font-semibold transition",
                  selected ? "border-transparent text-white" : "border-white/75 bg-white/78 text-slate-700 hover:bg-white"
                )}
                style={
                  selected
                    ? {
                        background: `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
                        boxShadow: "0 12px 24px rgba(59,130,246,0.22)",
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

      <Panel title="画笔与形状" icon={<Droplets className="h-5 w-5" />} right={<span>笔刷 {brushSize}</span>}>
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
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              "矩形实心",
              "显示色号",
              "显示坐标",
              "水平镜像",
              "颜色高亮",
              "文字生成",
            ].map((item) => (
              <GhostButton key={item}>{item}</GhostButton>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="选区与剪贴板" icon={<Copy className="h-5 w-5" />} right={<span>未选择</span>}>
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

      <Panel title="网格线" icon={<Grid3X3 className="h-5 w-5" />} right={<GhostButton>显示</GhostButton>}>
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
              onChange={(e) => setGridInterval(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">网格线颜色</div>
            <div className="flex flex-wrap gap-3">
              {gridLineColors.map((color) => (
                <button
                  key={color}
                  className="h-8 w-8 rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(30,41,59,0.08)] ring-1 ring-slate-300"
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

// 色板面板
interface PaletteSectionProps {
  selectedColor?: string;
  onColorSelect?: (color: { code: string; color: string }) => void;
}

function PaletteSection({ selectedColor, onColorSelect }: PaletteSectionProps) {
  return (
    <div className="space-y-4">
      <Panel title="画笔颜色选择" icon={<Palette className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="rounded-[20px] bg-[linear-gradient(180deg,#f7f9fd,#eef2f8)] px-4 py-3 text-center text-[17px] font-bold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
            完整色板（291）
          </div>
          <input
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400"
            placeholder="搜索色号（如 A01, B02）"
          />
          <div className="grid max-h-[300px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
            {palette.map((item, index) => (
              <ColorBlock
                key={item.code}
                code={item.code}
                color={item.color}
                active={index === 13}
                onClick={() => onColorSelect?.(item)}
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="替换杂色" icon={<Sparkles className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="rounded-[20px] bg-[linear-gradient(180deg,#f7f9fd,#eef2f8)] px-4 py-3 text-center text-[15px] font-bold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
            点击颜色替换为想要的颜色
          </div>
          <div className="grid max-h-[280px] grid-cols-5 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
            {replacePalette.map((item) => (
              <ColorBlock
                key={item.code}
                code={item.code}
                color={item.color}
                dark={item.dark}
                onClick={() => onColorSelect?.(item)}
              />
            ))}
          </div>
          <GhostButton full>一键恢复（撤销所有颜色更换）</GhostButton>
        </div>
      </Panel>
    </div>
  );
}

// 移动端工作区
interface MobileWorkspaceProps {
  viewMode: ViewMode;
  mobileTab: MobileTab;
  setMobileTab: (value: MobileTab | null) => void;
  width: number;
  setWidth: (value: number) => void;
  height: number;
  setHeight: (value: number) => void;
  merge: number;
  setMerge: (value: number) => void;
  preset: string;
  setPreset: (value: string) => void;
  activeTool: string;
  setActiveTool: (value: string) => void;
  brushSize: number;
  setBrushSize: (value: number) => void;
  gridInterval: number;
  setGridInterval: (value: number) => void;
}

function MobileWorkspace({
  viewMode,
  mobileTab,
  setMobileTab,
  width,
  setWidth,
  height,
  setHeight,
  merge,
  setMerge,
  preset,
  setPreset,
  activeTool,
  setActiveTool,
  brushSize,
  setBrushSize,
  gridInterval,
  setGridInterval,
}: MobileWorkspaceProps) {
  const sheetTitle =
    mobileTab === "process"
      ? "处理参数"
      : mobileTab === "tools"
      ? "精细工具"
      : mobileTab === "palette"
      ? "色板与替换"
      : "";

  return (
    <div className="xl:hidden pb-24">
      <GlassShell className="overflow-hidden p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-bold tracking-tight text-slate-900">
              {viewMode === "preprocess" ? "预处理预览" : viewMode === "refine" ? "精修预览" : "综合预览"}
            </div>
            <div className="mt-1 text-xs text-slate-400">手机端默认全屏看画布，工具改为隐藏式抽屉</div>
          </div>
          <div className="flex items-center gap-2">
            <TinyIconButton icon={<Undo2 className="h-4 w-4" />} />
            <TinyIconButton icon={<Redo2 className="h-4 w-4 opacity-50" />} />
          </div>
        </div>
        <CanvasPreview mobile />
      </GlassShell>

      <div className="fixed inset-x-3 bottom-3 z-30 sm:inset-x-4">
        <GlassShell className="p-2">
          <div className="grid grid-cols-3 gap-2">
            <MobileDockButton
              active={mobileTab === "process"}
              icon={<SlidersHorizontal className="h-4 w-4" />}
              label="参数"
              onClick={() => setMobileTab(mobileTab === "process" ? null : "process")}
            />
            <MobileDockButton
              active={mobileTab === "tools"}
              icon={<Pencil className="h-4 w-4" />}
              label="工具"
              onClick={() => setMobileTab(mobileTab === "tools" ? null : "tools")}
            />
            <MobileDockButton
              active={mobileTab === "palette"}
              icon={<Palette className="h-4 w-4" />}
              label="色板"
              onClick={() => setMobileTab(mobileTab === "palette" ? null : "palette")}
            />
          </div>
        </GlassShell>
      </div>

      <AnimatePresence>
        {mobileTab ? (
          <div className="fixed inset-0 z-40 flex items-end">
            <button className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setMobileTab(null)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22 }}
              className="relative z-10 max-h-[78vh] w-full overflow-hidden rounded-t-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(249,250,252,0.97),rgba(243,246,252,0.98))] shadow-[0_-18px_55px_rgba(30,41,59,0.12)] backdrop-blur-2xl"
            >
              <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl">
                <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-slate-200" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-bold tracking-tight text-slate-900">{sheetTitle}</div>
                    <div className="text-xs text-slate-400">点空白处可关闭，不影响画布观看</div>
                  </div>
                  <button
                    onClick={() => setMobileTab(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/75 bg-white/80 text-slate-500 shadow-[0_8px_18px_rgba(30,41,59,0.06)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-[calc(78vh-84px)] overflow-y-auto px-3 pb-5 pt-3 sm:px-4">
                {mobileTab === "process" ? (
                  <ProcessSection
                    width={width}
                    setWidth={setWidth}
                    height={height}
                    setHeight={setHeight}
                    merge={merge}
                    setMerge={setMerge}
                    preset={preset}
                    setPreset={setPreset}
                  />
                ) : null}
                {mobileTab === "tools" ? (
                  <ToolSection
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                    gridInterval={gridInterval}
                    setGridInterval={setGridInterval}
                  />
                ) : null}
                {mobileTab === "palette" ? <PaletteSection /> : null}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// 主组件
export default function ModernPerlerUI({
  // 回调函数，用于与现有功能集成
  onUpload,
  onCreateBlank,
  onApplyNumbers,
  onRemoveBackground,
  onGenerate,
  onDownload,
  onImport,
  onColorSelect,
  onToolSelect,
  onUndo,
  onRedo,
}: {
  onUpload?: () => void;
  onCreateBlank?: () => void;
  onApplyNumbers?: () => void;
  onRemoveBackground?: () => void;
  onGenerate?: () => void;
  onDownload?: () => void;
  onImport?: () => void;
  onColorSelect?: (color: { code: string; color: string }) => void;
  onToolSelect?: (tool: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}) {
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(100);
  const [merge, setMerge] = useState(30);
  const [preset, setPreset] = useState(presets[0]);
  const [activeTool, setActiveTool] = useState("拖拽");
  const [brushSize, setBrushSize] = useState(1);
  const [gridInterval, setGridInterval] = useState(5);
  const [mobileTab, setMobileTab] = useState<MobileTab>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("workspace");

  const modeButtonClass = (active: boolean) =>
    cn(
      "rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
      active ? "text-white" : "bg-white/80 text-slate-600 shadow-[0_8px_18px_rgba(30,41,59,0.05)]"
    );

  const modeButtonStyle = (active: boolean, orange = false) =>
    active
      ? {
          background: orange
            ? `linear-gradient(180deg, ${brandOrange}, #ff7400)`
            : `linear-gradient(180deg, ${brandBlue}, #2563eb)`,
          boxShadow: orange
            ? "0 12px 24px rgba(255,138,31,0.24)"
            : "0 12px 24px rgba(59,130,246,0.22)",
        }
      : undefined;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,1),rgba(243,246,252,0.96),rgba(237,240,246,0.98))] p-3 text-slate-800 sm:p-4 lg:p-5">
      <div className="mx-auto max-w-[1900px]">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-4"
        >
          <GlassShell className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ff7f8a,#ff5368)] text-xl shadow-[0_12px_24px_rgba(255,120,140,0.3)] ring-4 ring-emerald-500/95">
                  🍉
                </div>
                <div className="leading-tight">
                  <div className="text-[24px] font-black tracking-tight text-fuchsia-500">小瓜</div>
                  <div className="text-[13px] font-medium text-slate-500">拼豆原稿生成器</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  className={modeButtonClass(viewMode === "preprocess")}
                  style={modeButtonStyle(viewMode === "preprocess")}
                  onClick={() => {
                    setViewMode("preprocess");
                    setMobileTab(null);
                  }}
                >
                  预处理
                </button>
                <button
                  className={modeButtonClass(viewMode === "workspace")}
                  style={modeButtonStyle(viewMode === "workspace", true)}
                  onClick={() => {
                    setViewMode("workspace");
                    setMobileTab(null);
                  }}
                >
                  一体化工作台
                </button>
                <button
                  className={modeButtonClass(viewMode === "refine")}
                  style={modeButtonStyle(viewMode === "refine")}
                  onClick={() => {
                    setViewMode("refine");
                    setMobileTab(null);
                  }}
                >
                  精细修图
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <StatChip>MARD 291</StatChip>
                <GhostButton icon={<Import className="h-4 w-4" />} onClick={onImport}>导入</GhostButton>
                <PrimaryButton icon={<Download className="h-4 w-4" />} onClick={onDownload}>下载</PrimaryButton>
              </div>
            </div>
          </GlassShell>
        </motion.header>

        <MobileWorkspace
          viewMode={viewMode}
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          width={width}
          setWidth={setWidth}
          height={height}
          setHeight={setHeight}
          merge={merge}
          setMerge={setMerge}
          preset={preset}
          setPreset={setPreset}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          gridInterval={gridInterval}
          setGridInterval={setGridInterval}
        />

        {viewMode === "preprocess" ? (
          <div className="hidden xl:grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
            <motion.aside
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.04 }}
              className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-126px)] xl:overflow-y-auto xl:pr-1"
            >
              <ProcessSection
                width={width}
                setWidth={setWidth}
                height={height}
                setHeight={setHeight}
                merge={merge}
                setMerge={setMerge}
                preset={preset}
                setPreset={setPreset}
                onUpload={onUpload}
                onCreateBlank={onCreateBlank}
                onApplyNumbers={onApplyNumbers}
                onRemoveBackground={onRemoveBackground}
                onGenerate={onGenerate}
              />
            </motion.aside>

            <motion.main
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.06 }}
              className="space-y-4"
            >
              <GlassShell className="p-3 sm:p-4 lg:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[18px] font-bold tracking-tight text-slate-900">预处理页面</div>
                    <div className="mt-1 text-sm text-slate-400">专门处理上传、尺寸、颜色合并、去背景和预生成参数</div>
                  </div>
                  <PrimaryButton orange onClick={onGenerate}>开始生成图纸</PrimaryButton>
                </div>
                <CanvasPreview />
              </GlassShell>

              <div className="grid gap-4 md:grid-cols-3">
                <Panel title="当前方格" icon={<Grid3X3 className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">预设尺寸</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{width} × {height}</div>
                </Panel>
                <Panel title="处理模式" icon={<Palette className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">当前选择</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{preset}</div>
                </Panel>
                <Panel title="颜色合并" icon={<Droplets className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">当前阈值</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{merge}</div>
                </Panel>
              </div>
            </motion.main>
          </div>
        ) : null}

        {viewMode === "workspace" ? (
          <div className="hidden xl:grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_380px] 2xl:grid-cols-[360px_minmax(0,1fr)_400px] xl:items-start">
            <motion.aside
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.04 }}
              className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-126px)] xl:overflow-y-auto xl:pr-1"
            >
              <ProcessSection
                width={width}
                setWidth={setWidth}
                height={height}
                setHeight={setHeight}
                merge={merge}
                setMerge={setMerge}
                preset={preset}
                setPreset={setPreset}
                onUpload={onUpload}
                onCreateBlank={onCreateBlank}
                onApplyNumbers={onApplyNumbers}
                onRemoveBackground={onRemoveBackground}
                onGenerate={onGenerate}
              />
            </motion.aside>

            <motion.main
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.06 }}
              className="space-y-4"
            >
              <GlassShell className="p-3 sm:p-4 lg:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[18px] font-bold tracking-tight text-slate-900">主画布</div>
                    <div className="mt-1 text-sm text-slate-400">高清度网格 100×100 · 支持拖拽缩放</div>
                  </div>
                  <PrimaryButton icon={<Sparkles className="h-4 w-4" />} orange onClick={onGenerate}>
                    智能优化图纸
                  </PrimaryButton>
                </div>
                <CanvasPreview />
              </GlassShell>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="当前方格" icon={<Grid3X3 className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">当前工作区域</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{width} × {height}</div>
                </Panel>
                <Panel title="当前模式" icon={<Palette className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">正在使用</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{preset}</div>
                </Panel>
              </div>
            </motion.main>

            <motion.aside
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.08 }}
              className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-126px)] xl:overflow-y-auto xl:pr-1"
            >
              <div className="space-y-4">
                <ToolSection
                  activeTool={activeTool}
                  setActiveTool={(tool) => {
                    setActiveTool(tool);
                    onToolSelect?.(tool);
                  }}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  gridInterval={gridInterval}
                  setGridInterval={setGridInterval}
                />
                <PaletteSection onColorSelect={onColorSelect} />
              </div>
            </motion.aside>
          </div>
        ) : null}

        {viewMode === "refine" ? (
          <div className="hidden xl:grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
            <motion.main
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.06 }}
              className="space-y-4"
            >
              <GlassShell className="p-3 sm:p-4 lg:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[18px] font-bold tracking-tight text-slate-900">精细修图页面</div>
                    <div className="mt-1 text-sm text-slate-400">专门处理画笔、擦除、取色、替换杂色、色板与网格线等手工精修操作</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <GhostButton icon={<Undo2 className="h-4 w-4" />} onClick={onUndo}>撤销</GhostButton>
                    <PrimaryButton icon={<Pencil className="h-4 w-4" />} onClick={onGenerate}>进入精修</PrimaryButton>
                  </div>
                </div>
                <CanvasPreview />
              </GlassShell>

              <div className="grid gap-4 md:grid-cols-3">
                <Panel title="当前工具" icon={<Pencil className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">正在编辑</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{activeTool}</div>
                </Panel>
                <Panel title="笔刷大小" icon={<Droplets className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">当前参数</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{brushSize}</div>
                </Panel>
                <Panel title="网格线间隔" icon={<Grid3X3 className="h-5 w-5" />}>
                  <div className="text-sm text-slate-400">辅助设置</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{gridInterval}</div>
                </Panel>
              </div>
            </motion.main>

            <motion.aside
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.08 }}
              className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-126px)] xl:overflow-y-auto xl:pr-1"
            >
              <div className="space-y-4">
                <ToolSection
                  activeTool={activeTool}
                  setActiveTool={(tool) => {
                    setActiveTool(tool);
                    onToolSelect?.(tool);
                  }}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  gridInterval={gridInterval}
                  setGridInterval={setGridInterval}
                />
                <PaletteSection onColorSelect={onColorSelect} />
              </div>
            </motion.aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
