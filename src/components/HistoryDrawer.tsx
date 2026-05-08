'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp, Grid3x3, Palette } from 'lucide-react';

export interface HistoryItem {
  id: string;
  name: string;
  timestamp: number;
  thumbnail: string;
  style: string; // 风格标签，如"精致像素风"
  size: string; // 尺寸，如"50x50"
  code: string; // 编号，如"DoDo-24"
  pixelMatrix?: any; // 像素矩阵数据（可选）
  previewUrl?: string; // 拼豆图URL
  gridUrl?: string; // 网格图URL
  pureUrl?: string; // 纯像素图URL
  pixelImageUrl?: string; // AI优化图URL
  colorStats?: Array<{ // 色号用料统计
    hex: string;
    displayCode: string;
    masterCode: string;
    count: number;
  }>;
}

interface HistoryDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  historyList: HistoryItem[];
  onItemClick: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  isAtBottom?: boolean; // 是否固定在底部
}

export default function HistoryDrawer({
  isOpen,
  onToggle,
  historyList,
  onItemClick,
  onDelete,
  isAtBottom = false,
}: HistoryDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 220;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  }, []);

  // 滚动到最新添加的项目
  React.useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [historyList.length, isOpen]);

  return (
    <div className={`w-full rounded-2xl ${isAtBottom ? 'mt-auto border-t border-slate-100 pt-3' : ''}`}>
      {/* 展开/收起按钮 */}
      <button
        onClick={onToggle}
        className="mx-auto flex w-full items-center justify-between px-1 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          我的魔法记录
        </span>
        <span className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-400 text-[10px] font-bold text-white">
            {historyList.length}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </span>
      </button>

      {/* 抽屉内容 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {historyList.length === 0 ? (
              /* 空状态 */
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                  <Grid3x3 className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">暂无历史记录</p>
                <p className="mt-1 text-xs text-slate-400">生成图纸后会自动保存到这里</p>
              </div>
            ) : (
            <div className="relative rounded-xl bg-white/80 py-3 shadow-sm">
              {/* 滚动按钮 - 左 */}
              {historyList.length > 3 && (
                <button
                  onClick={() => scroll('left')}
                  className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md hover:bg-slate-50"
                >
                  <ChevronDown className="h-4 w-4 rotate-90 text-slate-600" />
                </button>
              )}

              {/* 横向滚动卡片列表 */}
              <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto px-8 scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {historyList.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex-shrink-0"
                  >
                    <div
                      onClick={() => onItemClick(item)}
                      className="group relative w-40 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {/* 标签 */}
                      <div className="absolute left-2 top-2 z-10 flex gap-1">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {item.style}
                        </span>
                      </div>

                      {/* 编号标签 */}
                      <div className="absolute right-2 top-2 z-10">
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                          {item.code}
                        </span>
                      </div>

                      {/* 缩略图 */}
                      <div className="aspect-square bg-slate-50">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-4xl opacity-50">
                            🎨
                          </div>
                        )}
                      </div>

                      {/* 底部信息 */}
                      <div className="p-2.5">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {item.style}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {item.size}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleDateString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </p>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('确定要删除此条记录吗？\n\n谨慎操作，不可恢复！')) {
                            onDelete(item.id);
                          }
                        }}
                        className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 opacity-0 transition-all hover:bg-red-100 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* 滚动按钮 - 右 */}
              {historyList.length > 3 && (
                <button
                  onClick={() => scroll('right')}
                  className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md hover:bg-slate-50"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90 text-slate-600" />
                </button>
              )}
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
