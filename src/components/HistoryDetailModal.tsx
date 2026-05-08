'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Download } from 'lucide-react';
import { HistoryItem } from './HistoryDrawer';

interface HistoryDetailModalProps {
  item: HistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  colorStats?: Array<{
    hex: string;
    displayCode: string;
    masterCode: string;
    count: number;
  }>;
  onDownloadHD?: (item: HistoryItem, viewMode: 'pixel' | 'grid' | 'perler') => void;
}

type ViewType = 'pixel' | 'grid' | 'perler';

export default function HistoryDetailModal({
  item,
  isOpen,
  onClose,
  colorStats = [],
  onDownloadHD,
}: HistoryDetailModalProps) {
  const [activeView, setActiveView] = useState<ViewType>('perler');
  const [isFavorite, setIsFavorite] = useState(false);
  // 缩略图（小尺寸用于切换按钮）
  const [gridThumbnail, setGridThumbnail] = useState<string | null>(null);
  const [perlerThumbnail, setPerlerThumbnail] = useState<string | null>(null);
  // 大图（用于主展示区）
  const [gridFullImage, setGridFullImage] = useState<string | null>(null);
  const [perlerFullImage, setPerlerFullImage] = useState<string | null>(null);

  // 加载图片并生成网格图/拼豆图
  useEffect(() => {
    if (!isOpen || !item) return;

    const generateImages = async () => {
      const sourceImage = item.pureUrl || item.pixelImageUrl || item.thumbnail;
      if (!sourceImage) return;

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = sourceImage;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const cols = item.width || 50;
        const rows = item.height || 50;

        // 1. 生成小缩略图（用于切换按钮）
        const thumbSize = 64;
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          thumbCtx.drawImage(img, 0, 0, thumbSize, thumbSize);
          
          if (activeView === 'grid' || true) {
            // 绘制网格线
            thumbCtx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
            thumbCtx.lineWidth = 0.5;
            const cellSize = thumbSize / Math.min(cols, 30);
            const gridCols = Math.min(cols, 30);
            const gridRows = Math.min(rows, 30);
            
            for (let i = 0; i <= gridCols; i++) {
              thumbCtx.beginPath();
              thumbCtx.moveTo(i * cellSize, 0);
              thumbCtx.lineTo(i * cellSize, thumbSize);
              thumbCtx.stroke();
            }
            for (let j = 0; j <= gridRows; j++) {
              thumbCtx.beginPath();
              thumbCtx.moveTo(0, j * cellSize);
              thumbCtx.lineTo(thumbSize, j * cellSize);
              thumbCtx.stroke();
            }
          }
          
          setGridThumbnail(thumbCanvas.toDataURL('image/png'));
        }

        // 2. 生成拼豆图缩略图（带色号）
        const perlerCanvas = document.createElement('canvas');
        perlerCanvas.width = thumbSize;
        perlerCanvas.height = thumbSize;
        const perlerCtx = perlerCanvas.getContext('2d');
        if (perlerCtx) {
          perlerCtx.drawImage(img, 0, 0, thumbSize, thumbSize);
          
          // 绘制网格和色号
          perlerCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          perlerCtx.lineWidth = 0.5;
          perlerCtx.fillStyle = '#333';
          perlerCtx.font = '4px Arial';
          perlerCtx.textAlign = 'center';
          perlerCtx.textBaseline = 'middle';
          
          const gridCols = Math.min(cols, 16);
          const gridRows = Math.min(rows, 16);
          const cellSize = thumbSize / Math.max(gridCols, gridRows);
          
          for (let i = 0; i <= gridCols; i++) {
            perlerCtx.beginPath();
            perlerCtx.moveTo(i * cellSize, 0);
            perlerCtx.lineTo(i * cellSize, thumbSize);
            perlerCtx.stroke();
          }
          for (let j = 0; j <= gridRows; j++) {
            perlerCtx.beginPath();
            perlerCtx.moveTo(0, j * cellSize);
            perlerCtx.lineTo(thumbSize, j * cellSize);
            perlerCtx.stroke();
          }
          
          // 只在某些格子绘制色号（增加colorStats非空检查）
          if (colorStats.length > 0) {
            for (let i = 0; i < gridCols; i += 2) {
              for (let j = 0; j < gridRows; j += 2) {
                const code = colorStats[i % colorStats.length]?.displayCode || '';
                if (code) {
                  perlerCtx.fillText(code.substring(0, 3), i * cellSize + cellSize / 2, j * cellSize + cellSize / 2);
                }
              }
            }
          }
          
          setPerlerThumbnail(perlerCanvas.toDataURL('image/png'));
        }

        // 3. 生成大尺寸网格图（用于主展示区）
        const maxDisplaySize = 400;
        const aspectRatio = cols / rows;
        let displayWidth, displayHeight;
        if (aspectRatio > 1) {
          displayWidth = maxDisplaySize;
          displayHeight = Math.round(maxDisplaySize / aspectRatio);
        } else {
          displayHeight = maxDisplaySize;
          displayWidth = Math.round(maxDisplaySize * aspectRatio);
        }
        
        const gridFullCanvas = document.createElement('canvas');
        gridFullCanvas.width = displayWidth;
        gridFullCanvas.height = displayHeight;
        const gridFullCtx = gridFullCanvas.getContext('2d');
        if (gridFullCtx) {
          gridFullCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
          
          // 绘制网格线
          gridFullCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          gridFullCtx.lineWidth = 1;
          const cellWidth = displayWidth / cols;
          const cellHeight = displayHeight / rows;
          
          for (let i = 0; i <= cols; i++) {
            gridFullCtx.beginPath();
            gridFullCtx.moveTo(i * cellWidth, 0);
            gridFullCtx.lineTo(i * cellWidth, displayHeight);
            gridFullCtx.stroke();
          }
          for (let j = 0; j <= rows; j++) {
            gridFullCtx.beginPath();
            gridFullCtx.moveTo(0, j * cellHeight);
            gridFullCtx.lineTo(displayWidth, j * cellHeight);
            gridFullCtx.stroke();
          }
          
          setGridFullImage(gridFullCanvas.toDataURL('image/png'));
        }

        // 4. 生成大尺寸拼豆图（用于主展示区）
        const perlerFullCanvas = document.createElement('canvas');
        perlerFullCanvas.width = displayWidth;
        perlerFullCanvas.height = displayHeight;
        const perlerFullCtx = perlerFullCanvas.getContext('2d');
        if (perlerFullCtx) {
          perlerFullCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
          
          // 绘制网格
          perlerFullCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          perlerFullCtx.lineWidth = 1;
          const cellWidth = displayWidth / cols;
          const cellHeight = displayHeight / rows;
          
          for (let i = 0; i <= cols; i++) {
            perlerFullCtx.beginPath();
            perlerFullCtx.moveTo(i * cellWidth, 0);
            perlerFullCtx.lineTo(i * cellWidth, displayHeight);
            perlerFullCtx.stroke();
          }
          for (let j = 0; j <= rows; j++) {
            perlerFullCtx.beginPath();
            perlerFullCtx.moveTo(0, j * cellHeight);
            perlerFullCtx.lineTo(displayWidth, j * cellHeight);
            perlerFullCtx.stroke();
          }
          
          // 绘制色号（读取真实矩阵数据）
          const fontSize = Math.min(cellWidth, cellHeight) * 0.8;
          perlerFullCtx.font = `bold ${fontSize}px Arial`;
          perlerFullCtx.textAlign = 'center';
          perlerFullCtx.textBaseline = 'middle';
          
          // 🚨 修复：读取真实矩阵数据绘制色号
          if (item.pixelMatrix && item.pixelMatrix.length > 0) {
            const matrix = item.pixelMatrix;
            const mRows = matrix.length;
            const mCols = matrix[0].length;
            const cWidth = displayWidth / mCols;
            const cHeight = displayHeight / mRows;
            const codeFontSize = Math.max(6, Math.min(cWidth, cHeight) * 0.35);
            perlerFullCtx.font = `bold ${codeFontSize}px Arial`;

            for (let y = 0; y < mRows; y++) {
              for (let x = 0; x < mCols; x++) {
                const cell = matrix[y][x];
                if (!cell || !cell.code || cell.code === 'transparent' || cell.code === '未知') continue;
                // 根据亮度决定文字黑白
                let r=255, g=255, b=255;
                if (cell.rgb) { r=cell.rgb.r; g=cell.rgb.g; b=cell.rgb.b; }
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                perlerFullCtx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
                // 绘制文字并限制宽度
                perlerFullCtx.fillText(String(cell.code).slice(-4), x * cWidth + cWidth / 2, y * cHeight + cHeight / 2, cWidth - 1);
              }
            }
          }
          
          setPerlerFullImage(perlerFullCanvas.toDataURL('image/png'));
        }
      } catch (error) {
        console.error('生成图片失败:', error);
      }
    };

    generateImages();
  }, [isOpen, item, colorStats]);

  if (!isOpen || !item) return null;

  const getCurrentImageUrl = () => {
    switch (activeView) {
      case 'pixel':
        return item.pureUrl || item.pixelImageUrl || item.thumbnail;
      case 'grid':
        return gridFullImage || gridThumbnail || item.thumbnail;
      case 'perler':
        return perlerFullImage || perlerThumbnail || item.thumbnail;
      default:
        return item.thumbnail;
    }
  };

  const getViewDescription = () => {
    switch (activeView) {
      case 'pixel':
        return '纯像素效果展示';
      case 'grid':
        return '带网格线辅助制作';
      case 'perler':
        return '包含完整色号标注，适合打印施工';
      default:
        return '';
    }
  };

  const handleDownload = async () => {
    // 🚨 拦截下载！如果有高清下载引擎，且有真实的矩阵数据，直接调用高清引擎！
    if (onDownloadHD && item?.pixelMatrix) {
      onDownloadHD(item, activeView);
      return;
    }

    // 原有的降级下载逻辑（仅作备用）
    const imageUrl = getCurrentImageUrl();
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.code}-${activeView === 'pixel' ? '像素图' : activeView === 'grid' ? '网格图' : '拼豆图'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* 弹窗内容 */}
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>

          {/* 主标题 */}
          <h2 className="text-xl font-bold text-slate-800">{item.style}</h2>
          
          {/* 标签栏 */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-500">
              {item.style}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {item.size}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {item.code}
            </span>
          </div>

          {/* 时间戳 */}
          <p className="mt-2 text-xs text-slate-400">
            {new Date(item.timestamp).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </div>

        {/* 图纸切换区 - 三个按钮统一尺寸 */}
        <div className="px-5">
          <div className="flex gap-2">
            {/* 像素图 */}
            <button
              onClick={() => setActiveView('pixel')}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                activeView === 'pixel'
                  ? 'bg-rose-100 ring-2 ring-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
                {(item.pureUrl || item.pixelImageUrl || item.thumbnail) ? (
                  <img
                    src={item.pureUrl || item.pixelImageUrl || item.thumbnail}
                    alt="像素图"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">
                    暂无
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium ${activeView === 'pixel' ? 'text-rose-500' : 'text-slate-600'}`}>
                像素图
              </span>
            </button>

            {/* 网格图 */}
            <button
              onClick={() => setActiveView('grid')}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                activeView === 'grid'
                  ? 'bg-rose-100 ring-2 ring-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
                {gridThumbnail ? (
                  <img
                    src={gridThumbnail}
                    alt="网格图"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">
                    暂无
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium ${activeView === 'grid' ? 'text-rose-500' : 'text-slate-600'}`}>
                网格图
              </span>
            </button>

            {/* 拼豆图 */}
            <button
              onClick={() => setActiveView('perler')}
              className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl p-3 transition-all ${
                activeView === 'perler'
                  ? 'bg-rose-100 ring-2 ring-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white">
                {perlerThumbnail ? (
                  <img
                    src={perlerThumbnail}
                    alt="拼豆图"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs">
                    暂无
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium ${activeView === 'perler' ? 'text-rose-500' : 'text-slate-600'}`}>
                拼豆图
              </span>
            </button>
          </div>

          {/* 当前查看说明 */}
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700">
              当前查看：{activeView === 'pixel' ? '像素图' : activeView === 'grid' ? '网格图' : '拼豆图'}
            </p>
            <p className="text-xs text-slate-500">{getViewDescription()}</p>
          </div>
        </div>

        {/* 主图纸展示区 - 统一展示大图 */}
        <div className="mt-4 px-5">
          <div className="overflow-hidden rounded-2xl bg-slate-100">
            <div className="flex items-center justify-center p-4">
              {getCurrentImageUrl() ? (
                <img
                  src={getCurrentImageUrl()}
                  alt="图纸"
                  className="max-h-[300px] w-auto object-contain"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center text-slate-400">
                  暂无图片
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 色号用料统计 - 复用 ai-pixels 里的样式 */}
        {colorStats.length > 0 && (
          <div className="mt-4 px-5 pb-4">
            <h4 className="mb-2 text-sm font-medium text-slate-700">
              色号用料统计 <span className="text-slate-400 text-xs font-normal">（图纸共使用 {colorStats.length} 色）</span>
            </h4>
            <div className="grid max-h-64 grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 overflow-y-auto pr-2 pb-2">
              {colorStats.map((stat, index) => {
                const hexStr = stat.hex.replace('#', '');
                const r = parseInt(hexStr.substring(0, 2), 16) || 255;
                const g = parseInt(hexStr.substring(2, 4), 16) || 255;
                const b = parseInt(hexStr.substring(4, 6), 16) || 255;
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness > 128 ? '#111827' : '#ffffff';
                return (
                  <div key={`hist_stat_${index}`} className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all hover:-translate-y-0.5">
                    <div className="h-8 w-full flex items-center justify-center text-[12px] font-black" style={{ backgroundColor: stat.hex, color: textColor }}>
                      {stat.displayCode}
                    </div>
                    <div className="h-7 w-full bg-white flex items-center justify-center border-t border-slate-100 text-[11px] font-bold text-slate-700">
                      {stat.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 底部操作按钮 */}
        <div className="sticky bottom-0 z-10 flex gap-3 border-t border-slate-100 bg-white p-5">
          {/* 收藏按钮 */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all ${
              isFavorite
                ? 'bg-rose-50 text-rose-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            <span>{item.code}</span>
          </button>

          {/* 下载按钮 */}
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-400 py-3 text-sm font-medium text-white transition-all hover:bg-rose-500"
          >
            <Download className="h-4 w-4" />
            <span>下载当前图片</span>
          </button>
        </div>
      </div>
    </div>
  );
}
