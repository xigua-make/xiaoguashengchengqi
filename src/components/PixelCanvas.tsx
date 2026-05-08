'use client';

import React, { useEffect, useRef } from 'react';

export type ViewMode = 'pixel' | 'grid' | 'pattern';

interface PixelCanvasProps {
  matrix: any; // 故意改成 any，用来接住错误数据并报错
  mode: ViewMode;
  isThumbnail?: boolean;
}

export default function PixelCanvas({ matrix, mode, isThumbnail = false }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ==========================================
    // 🚨 终极防空/报错系统：如果数据不对，直接在画布上画红框报错！
    // ==========================================
    if (!matrix) {
      ctx.fillStyle = '#ffebee'; ctx.fillRect(0, 0, 300, 150);
      ctx.fillStyle = 'red'; ctx.font = '14px Arial';
      ctx.fillText('❌ 错误: matrix 是空的 (undefined)', 10, 50);
      return;
    }
    if (!Array.isArray(matrix)) {
      ctx.fillStyle = '#ffebee'; ctx.fillRect(0, 0, 300, 150);
      ctx.fillStyle = 'red'; ctx.font = '14px Arial';
      ctx.fillText('❌ 错误: matrix 不是数组！', 10, 40);
      ctx.fillText(`你传的是: ${typeof matrix}`, 10, 70);
      // 如果错传成了 base64 图片字符串，会显示在这里
      if (typeof matrix === 'string') ctx.fillText('你好像传成了图片URL或Base64', 10, 100);
      return;
    }
    if (!matrix[0] || !Array.isArray(matrix[0])) {
      ctx.fillStyle = '#ffebee'; ctx.fillRect(0, 0, 300, 150);
      ctx.fillStyle = 'red'; ctx.font = '14px Arial';
      ctx.fillText('❌ 错误: matrix 不是二维数组！', 10, 50);
      return;
    }

    // ==========================================
    // ✅ 数据正确，开始正常渲染
    // ==========================================
    try {
      const rows = matrix.length;
      const cols = matrix[0].length;

      // 缩略图画小点(4px)，主图画大点(20px)保证清晰
      const cellSize = isThumbnail ? 4 : 20;
      const padding = (!isThumbnail && mode === 'pattern') ? 30 : 0;

      canvas.width = cols * cellSize + padding * 2;
      canvas.height = rows * cellSize + padding * 2;

      ctx.fillStyle = mode === 'pixel' ? '#111111' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = matrix[y][x];
          if (!cell) continue;

          // 兼容你的 RGB 数据结构
          let r = 255, g = 255, b = 255;
          if (cell.rgb) { r = cell.rgb.r; g = cell.rgb.g; b = cell.rgb.b; } 
          else if (cell.r !== undefined) { r = cell.r; g = cell.g; b = cell.b; }

          const cx = padding + x * cellSize;
          const cy = padding + y * cellSize;

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(cx, cy, cellSize, cellSize);

          // 略缩图模式：添加边框区分 grid/pattern
          if (isThumbnail && (mode === 'grid' || mode === 'pattern')) {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(cx, cy, cellSize, cellSize);
          }

          // 主图的拼豆模式：画色号
          if (!isThumbnail && mode === 'pattern') {
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            ctx.fillStyle = brightness > 128 ? '#000000' : '#FFFFFF';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const code = (cell.code || cell.id || '').toString().replace(/[^a-zA-Z0-9]/g, '').slice(-3);
            ctx.fillText(code, cx + cellSize / 2, cy + cellSize / 2);
          }
        }
      }

      // 画辅助网格
      if (mode === 'grid' || mode === 'pattern') {
        const gridCellSize = isThumbnail ? 1 : cellSize;
        const gridPadding = isThumbnail ? 0 : padding;
        
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) { 
          ctx.moveTo(gridPadding + i * gridCellSize, gridPadding); 
          ctx.lineTo(gridPadding + i * gridCellSize, gridPadding + rows * gridCellSize); 
        }
        for (let j = 0; j <= rows; j++) { 
          ctx.moveTo(gridPadding, gridPadding + j * gridCellSize); 
          ctx.lineTo(gridPadding + cols * gridCellSize, gridPadding + j * gridCellSize); 
        }
        ctx.lineWidth = 0.5; ctx.strokeStyle = '#666666'; ctx.stroke();

        if (!isThumbnail) {
          ctx.beginPath();
          for (let i = 0; i <= cols; i += 5) { ctx.moveTo(padding + i * cellSize, padding); ctx.lineTo(padding + i * cellSize, padding + rows * cellSize); }
          for (let j = 0; j <= rows; j += 5) { ctx.moveTo(padding, padding + j * cellSize); ctx.lineTo(padding + cols * cellSize, padding + j * cellSize); }
          ctx.lineWidth = 2; ctx.strokeStyle = '#444444'; ctx.stroke();
        }
      }

    } catch (error) {
      console.error(error);
    }
  }, [matrix, mode, isThumbnail]);

  return (
    <canvas 
      ref={canvasRef} 
      className="max-w-full max-h-full object-contain mx-auto transition-opacity duration-300" 
      style={{ minWidth: '100px', minHeight: '100px' }} // 强行撑开一点高度，防止完全看不见报错
    />
  );
}
