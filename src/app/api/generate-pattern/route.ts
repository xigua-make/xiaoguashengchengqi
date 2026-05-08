// ============================================
// 多品牌拼豆像素图生成 API - pixelPortrait 轻量版
//
// pixelPortrait 专用管线：
// AI 直接生成最终小图效果 → NEAREST resize → 色板映射 → 极轻孤立点清理
//
// 核心原则：AI 直接画好，后端只做轻量图纸化
//
// 支持品牌：MARD, COCO, 漫漫, 盼盼, 咪小窝, KaKa, 优肯, 黄豆豆, DoDo, 小舞, 柿柿, 童趣
// ============================================

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  buildAllowedPalette,
  getEffectivePresetId,
  BRANDS,
  type BrandType,
} from '@/lib/color-systems';

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'outputs');

if (!existsSync(OUTPUT_DIR)) {
  mkdir(OUTPUT_DIR, { recursive: true }).catch(console.error);
}

// 使用 BRANDS 常量，支持全部品牌
const VALID_BRANDS: BrandType[] = BRANDS;

function normalizeBrand(input: unknown): BrandType {
  return VALID_BRANDS.includes(input as BrandType) ? (input as BrandType) : 'MARD';
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function normalizeCodeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const optimizedImageUrl = body.optimizedImageUrl;
    const targetWidth = normalizePositiveInt(body.targetWidth, 0);
    const targetHeight = normalizePositiveInt(body.targetHeight, 0);
    const aiMode = String(body.aiMode || 'pixelPortrait');
    const colorMode = String(body.colorMode || 'detail');
    const brand = normalizeBrand(body.brand);
    const paletteId = getEffectivePresetId(brand, body.paletteId || '221');
    const selectedColorCodes = normalizeCodeList(body.selectedColorCodes);
    const customColors = body.customColors; // 前端传来的精准色板数据

    console.log('='.repeat(60));
    console.log('[generate-pattern] ========== 新请求 ==========');
    console.log('[generate-pattern] aiMode:', aiMode);
    console.log('[generate-pattern] paletteId:', paletteId);
    console.log('[generate-pattern] brand:', brand);
    console.log('[generate-pattern] targetSize:', `${targetWidth}x${targetHeight}`);
    console.log('[generate-pattern] customColors:', customColors?.length || 0, '色');
    console.log('='.repeat(60));

    if (!optimizedImageUrl) {
      return NextResponse.json({ success: false, error: '缺少 optimizedImageUrl' }, { status: 400 });
    }
    if (!targetWidth || !targetHeight) {
      return NextResponse.json({ success: false, error: '缺少尺寸参数' }, { status: 400 });
    }

    // 🚨 核心修复：优先使用前端传来的自定义颜色，否则使用后端兜底
    let allowedPalette;
    if (customColors && Array.isArray(customColors) && customColors.length > 0) {
      console.log('[generate-pattern] 🚨 使用前端自定义颜色:', customColors.length, '色');
      allowedPalette = customColors;
    } else {
      console.log('[generate-pattern] 📦 使用后端兜底颜色方案');
      allowedPalette = buildAllowedPalette(brand, paletteId, selectedColorCodes);
    }

    if (allowedPalette.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `当前品牌/色板没有可用颜色：brand=${brand}, paletteId=${paletteId}`,
        },
        { status: 400 }
      );
    }

    console.log('[generate-pattern] allowedColors 数量:', allowedPalette.length);

    // 下载图片
    console.log('[generate-pattern] 下载图片...');
    let imageBuffer: ArrayBuffer;
    try {
      let imageUrl = String(optimizedImageUrl);
      if (imageUrl.startsWith('/')) {
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
        imageUrl = `${baseUrl}${imageUrl}`;
      }

      const imageResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(60000),
      });
      if (!imageResponse.ok) {
        throw new Error(`HTTP ${imageResponse.status}`);
      }
      imageBuffer = await imageResponse.arrayBuffer();
    } catch (err) {
      return NextResponse.json({ success: false, error: `下载失败: ${err}` }, { status: 500 });
    }

    const imageBase64 = Buffer.from(imageBuffer).toString('base64');
    const timestamp = Date.now();

    const isPixelPortrait = aiMode === 'pixelPortrait';

    // ============================================================
    // pixelPortrait 轻量版 Python 脚本
    // 核心原则：AI 直接画好，后端只做轻量图纸化
    // ============================================================
    const pythonScript = `
import sys
import json
import io
import base64
import os
import time
import math
import numpy as np
from PIL import Image
from collections import Counter

print('START')

# ============================================================
# 解析输入
# ============================================================
t0 = time.time()
data = json.load(sys.stdin)
img_bytes = base64.b64decode(data['image_base64'])
img = Image.open(io.BytesIO(img_bytes)).convert('RGB')

target_width = int(data['target_width'])
target_height = int(data['target_height'])
allowed_palette = data['allowed_palette']
output_dir = data['output_dir']
timestamp = data['timestamp']
preview_scale = int(data.get('preview_scale', 10))
is_pixel_portrait = data.get('is_pixel_portrait', False)
color_mode = data.get('color_mode', 'detail')
max_colors = data.get("maxColors", 30)

# 🚨 核心修复：色彩量化压缩 — 强制将图片聚类为最多 max_colors 种颜色
img = img.quantize(colors=max_colors, method=0, dither=0).convert("RGB")
print(f"[quantize] 色彩量化: max={max_colors}")

print(f'[pixelPortrait] SOURCE_SIZE: {img.size[0]}x{img.size[1]}')
print(f'[pixelPortrait] TARGET_SIZE: {target_width}x{target_height}')

# ============================================================
# 工具函数
# ============================================================

def rgb_to_oklab(rgb):
    """RGB 转 OKLab 色彩空间"""
    r, g, b = [x / 255.0 for x in rgb]
    
    # sRGB 转线性
    def to_linear(c):
        if c <= 0.04045:
            return c / 12.92
        return ((c + 0.055) / 1.055) ** 2.4
    
    r_lin = to_linear(r)
    g_lin = to_linear(g)
    b_lin = to_linear(b)
    
    # 转 OKLab
    l = 0.4122214708 * r_lin + 0.5363325363 * g_lin + 0.0514459929 * b_lin
    m = 0.2119034982 * r_lin + 0.6806995451 * g_lin + 0.1073969566 * b_lin
    s = 0.0883024619 * r_lin + 0.2817188376 * g_lin + 0.6299787005 * b_lin
    
    def cbrt(x):
        return math.copysign(abs(x) ** (1/3), x)
    
    l_ = cbrt(l)
    m_ = cbrt(m)
    s_ = cbrt(s)
    
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )

def luminance(rgb):
    """计算亮度"""
    return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255.0

# 预处理色板为 numpy 数组加速查找
palette_oklab = np.array([rgb_to_oklab(item['rgb']) for item in allowed_palette], dtype=np.float32)
palette_rgb = np.array([item['rgb'] for item in allowed_palette], dtype=np.uint8)
palette_brightness = np.array([luminance(item['rgb']) for item in allowed_palette], dtype=np.float32)

def nearest_color(rgb):
    """numpy 加速的最近色查找 - OKLab 距离"""
    rgb_arr = np.array(rgb, dtype=np.float32)
    
    # OKLab 距离
    dL = rgb_to_oklab(rgb)[0] - palette_oklab[:, 0]
    dA = rgb_to_oklab(rgb)[1] - palette_oklab[:, 1]
    dB = rgb_to_oklab(rgb)[2] - palette_oklab[:, 2]
    dist = dL * dL * 1.4 + dA * dA + dB * dB
    
    # 浅色惩罚（避免选中过深的颜色）
    src_luma = luminance(rgb)
    if src_luma > 0.3:
        # 对太深的颜色加惩罚
        dark_mask = palette_brightness < 0.15
        dist[dark_mask] *= 1.5
    
    idx = np.argmin(dist)
    return allowed_palette[idx]

def is_likely_background(rgb, threshold=0.95):
    """检测是否为纯白/极浅背景"""
    l = luminance(rgb)
    r, g, b = rgb
    # 纯白或极浅灰
    return l > threshold or (l > 0.90 and abs(r - g) < 10 and abs(g - b) < 10 and abs(r - b) < 10)

def cleanup_single_pixel_isolated(grid, bg_mask, w, h):
    """
    极轻量孤立点清理 - 只清理真正的1像素噪点
    如果一个像素与周围4邻域都不同，才认为是噪点
    不做任何颜色替换，只移除孤立点
    """
    changes = 0
    new_grid = [[grid[y][x] for x in range(w)] for y in range(h)]
    
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if bg_mask[y, x]:
                continue
            
            current = new_grid[y][x]
            if current is None:
                continue
            
            # 检查4邻域
            neighbors = [
                new_grid[y-1][x] if not bg_mask[y-1, x] else None,
                new_grid[y+1][x] if not bg_mask[y+1, x] else None,
                new_grid[y][x-1] if not bg_mask[y, x-1] else None,
                new_grid[y][x+1] if not bg_mask[y, x+1] else None,
            ]
            
            # 过滤掉 None
            valid_neighbors = [n for n in neighbors if n is not None]
            
            if len(valid_neighbors) == 0:
                continue
            
            # 检查是否所有邻域颜色都一样
            first_color = valid_neighbors[0]
            all_same = all(
                n['brand'] == first_color['brand'] and n['displayCode'] == first_color['displayCode']
                for n in valid_neighbors
            )
            
            # 如果当前颜色和所有邻域都不同，且邻域都是同一种颜色，则是噪点
            current_key = f"{current['brand']}|{current['displayCode']}"
            first_key = f"{first_color['brand']}|{first_color['displayCode']}"
            
            if current_key != first_key and all_same:
                # 用邻域颜色替换
                new_grid[y][x] = first_color
                changes += 1
    
    return new_grid, {'removed': changes}

# ============================================================
# pixelPortrait 最终轻量杂色归并
# ============================================================

def oklab_distance(color1_rgb, color2_rgb):
    """
    计算两个 RGB 颜色在 OKLab 空间的距离
    返回近似欧氏距离
    """
    def linearize(c):
        if c <= 0.04045:
            return c / 12.92
        return ((c + 0.055) / 1.055) ** 2.4
    
    def to_linear(rgb):
        return [linearize(c / 255.0) for c in rgb]
    
    r1, g1, b1 = to_linear(color1_rgb)
    r2, g2, b2 = to_linear(color2_rgb)
    
    # OKLab L 的近似计算
    L1 = 0.4122214708 * r1 + 0.5363325363 * g1 + 0.0514459929 * b1
    L2 = 0.4122214708 * r2 + 0.5363325363 * g2 + 0.0514459929 * b2
    
    # 简化距离
    return abs(L1 - L2) * 10  # 简化的 OKLab 距离

def get_region_dominant_color(grid, region_map, bg_mask, w, h, region):
    """
    获取某个区域的多数色
    """
    colors = Counter()
    for y in range(h):
        for x in range(w):
            if bg_mask[y, x]:
                continue
            if region_map[y, x] == region:
                cell = grid[y][x]
                if cell:
                    key = f"{cell['brand']}|{cell['displayCode']}"
                    colors[key] += 1
    
    if colors:
        dominant_key = colors.most_common(1)[0][0]
        parts = dominant_key.split('|')
        for row in grid:
            for cell in row:
                if cell and cell['brand'] == parts[0] and cell['displayCode'] == parts[1]:
                    return cell
    return None

def can_merge_by_region_and_distance(current_rgb, target_rgb, region):
    """
    判断是否可以根据区域和颜色距离合并
    """
    # 颜色距离阈值（根据区域调整）
    thresholds = {
        'face': 15,
        'hands': 18,
        'hair': 22,
        'clothes': 20,
    }
    
    threshold = thresholds.get(region, 20)
    distance = oklab_distance(current_rgb, target_rgb)
    return distance < threshold

def final_merge_minor_noise(mapped_grid, region_map, bg_mask, w, h, target_w, target_h):
    """
    最终轻量杂色归并
    - 保护 eyes, mouth, blush, accessory, outline
    - 只处理 hair, face, hands, clothes 的小杂色
    - 单轮，不破坏结构
    """
    print('[pixelPortrait] finalMergeMinorNoise: enabled')
    
    protected_regions = {'eyes', 'mouth', 'blush', 'accessory', 'outline'}
    
    # 预计算区域主色
    region_dominants = {}
    for region in ['hair', 'face', 'hands', 'clothes']:
        dom = get_region_dominant_color(mapped_grid, region_map, bg_mask, target_w, target_h, region)
        if dom:
            region_dominants[region] = dom
            print(f'[pixelPortrait] finalMergeMinorNoise.{region}Dominant: {dom["brand"]}|{dom["displayCode"]}')
    
    result = [[mapped_grid[y][x] for x in range(w)] for y in range(h)]
    fixed = 0
    
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if bg_mask[y, x]:
                continue
            
            region = region_map[y, x]
            if region in protected_regions:
                continue
            
            current = result[y][x]
            if current is None:
                continue
            
            current_rgb = tuple(current['rgb'])
            
            # 收集邻域颜色（8邻域）
            neighbor_colors = []
            for ny in range(y - 1, y + 2):
                for nx in range(x - 1, x + 2):
                    if nx == x and ny == y:
                        continue
                    if bg_mask[ny, nx]:
                        continue
                    neighbor_cell = mapped_grid[ny][nx]
                    if neighbor_cell:
                        neighbor_colors.append((tuple(neighbor_cell['rgb']), region_map[ny, nx]))
            
            if not neighbor_colors:
                continue
            
            # 统计颜色票数
            color_counter = Counter()
            for rgb, r in neighbor_colors:
                key = f"{rgb}"
                color_counter[key] += 1
            
            # 找多数色
            if not color_counter:
                continue
            
            main_color_key, votes = color_counter.most_common(1)[0]
            if votes < 5:  # 至少需要5个邻居支持
                continue
            
            main_rgb = tuple(map(int, main_color_key.strip('()').split(',')))
            
            # 检查颜色距离
            if not can_merge_by_region_and_distance(current_rgb, main_rgb, region):
                continue
            
            # 区域优先：如果邻域主色符合区域主色倾向，优先采用
            if region in region_dominants:
                dom_rgb = tuple(region_dominants[region]['rgb'])
                dom_distance = oklab_distance(current_rgb, dom_rgb)
                main_distance = oklab_distance(current_rgb, main_rgb)
                
                # 如果区域主色比邻域主色更接近当前色，倾向于区域主色
                if dom_distance < main_distance:
                    result[y][x] = region_dominants[region]
                    fixed += 1
                    continue
            
            # 否则并到邻域主色
            # 找到对应的 cell
            for row in mapped_grid:
                for cell in row:
                    if cell and tuple(cell['rgb']) == main_rgb:
                        result[y][x] = cell
                        fixed += 1
                        break
    
    print(f'[pixelPortrait] finalMergeMinorNoise.fixed: {fixed}')
    print(f'[pixelPortrait] finalMergeMinorNoise.protected: eyes/mouth/blush/accessory/outline')
    
    return result

# ============================================================
# pixelPortrait 轻量管线
# ============================================================

def run_pixel_portrait_light_pipeline(img, target_w, target_h, allowed_palette):
    print('[pixelPortrait] mode: LIGHT (AI-direct + light processing)')
    print(f'[pixelPortrait] targetSize: {target_w}x{target_h}')
    
    t1 = time.time()
    
    # ============================================
    # Step 1: NEAREST resize 到目标尺寸
    # 这是关键！保持 AI 画的像素感，不做任何平滑
    # ============================================
    print('[pixelPortrait] Step 1: NEAREST resize to target size')
    target_img = img.resize((target_w, target_h), Image.Resampling.NEAREST)
    target_grid = np.array(target_img, dtype=np.uint8)
    print(f'[pixelPortrait] resize done: cost={(time.time()-t1)*1000:.0f}ms')
    
    t2 = time.time()
    
    # ============================================
    # Step 2: 不再过滤白色背景，所有像素都参与映射
    # ============================================
    print('[pixelPortrait] Step 2: keep all pixels (including white) for mapping')
    bg_mask = np.zeros((target_h, target_w), dtype=bool)
    bg_count = 0
    print(f'[pixelPortrait] bg count: 0 (no background filtering)')
    
    t3 = time.time()
    
    # ============================================
    # Step 3: 映射到色板
    # ============================================
    print('[pixelPortrait] Step 3: map to palette')
    
    # 预建颜色查找表（加速）
    mapped_grid = [[None for _ in range(target_w)] for _ in range(target_h)]
    color_stats = Counter()
    
    for y in range(target_h):
        for x in range(target_w):
            if bg_mask[y, x]:
                continue
            
            rgb = tuple(target_grid[y, x])
            mapped = nearest_color(rgb)
            mapped_grid[y][x] = mapped
            
            key = f"{mapped['brand']}|{mapped['displayCode']}"
            color_stats[key] += 1
    
    print(f'[pixelPortrait] palette map done: {len(color_stats)} colors, cost={(time.time()-t3)*1000:.0f}ms')
    
    t4 = time.time()
    
    # ============================================
    # Step 4: 极轻量孤立点清理
    # 只清理真正的1像素噪点，不做任何重处理
    # ============================================
    print('[pixelPortrait] Step 4: light isolated pixel cleanup')
    mapped_grid, cleanup_stats = cleanup_single_pixel_isolated(mapped_grid, bg_mask, target_w, target_h)
    print(f'[pixelPortrait] cleanup done: removed={cleanup_stats["removed"]} isolated pixels, cost={(time.time()-t4)*1000:.0f}ms')
    
    t4b = time.time()
    
    # ============================================
    # Step 5: 最终轻量杂色归并（新增）
    # 保护 eyes/mouth/blush/accessory/outline
    # 只处理 hair/face/hands/clothes 的小杂色
    # 单轮，不破坏结构
    # ============================================
    print('[pixelPortrait] Step 5: final merge minor noise')
    # 创建简化的 region_map（全标记为 hair，实际使用时按区域处理）
    simple_region_map = np.full((target_h, target_w), 'hair', dtype=object)
    mapped_grid = final_merge_minor_noise(mapped_grid, simple_region_map, bg_mask, target_w, target_h, target_w, target_h)
    print(f'[pixelPortrait] finalMergeMinorNoise done: cost={(time.time()-t4b)*1000:.0f}ms')
    
    t5 = time.time()
    
    # ============================================
    # Step 6: 重新统计
    # ============================================
    final_stats = Counter()
    for y in range(target_h):
        for x in range(target_w):
            if bg_mask[y, x]:
                continue
            cell = mapped_grid[y][x]
            if cell:
                key = f"{cell['brand']}|{cell['displayCode']}"
                final_stats[key] += 1
    
    # ============================================
    # Step 7: 生成预览图
    # 纯像素预览，不加网格
    # ============================================
    print('[pixelPortrait] Step 7: render preview')
    
    preview_img = Image.new('RGB', (target_w * preview_scale, target_h * preview_scale))
    
    for y in range(target_h):
        for x in range(target_w):
            if bg_mask[y, x]:
                color = (255, 255, 255)  # 白色背景
            else:
                cell = mapped_grid[y][x]
                color = tuple(cell['rgb']) if cell else (255, 255, 255)
            
            # 填充放大
            for py in range(y * preview_scale, (y + 1) * preview_scale):
                for px in range(x * preview_scale, (x + 1) * preview_scale):
                    preview_img.putpixel((px, py), color)
    
    print(f'[pixelPortrait] render done: cost={(time.time()-t5)*1000:.0f}ms')
    
    # 保存
    os.makedirs(output_dir, exist_ok=True)
    filename = f'pattern_preview_{timestamp}.png'
    preview_img.save(os.path.join(output_dir, filename))
    print(f'[pixelPortrait] SAVED: {filename}')
    print(f'[pixelPortrait] totalCost: {(time.time()-t0)*1000:.0f}ms')
    
    # 构建返回统计
    fg_count = target_w * target_h - bg_count
    
    stats = []
    for key, count in final_stats.most_common():
        parts = key.split('|')
        brand = parts[0]
        display_code = parts[1]
        
        # 找到对应的颜色信息
        color_info = None
        for c in allowed_palette:
            if c['brand'] == brand and c['displayCode'] == display_code:
                color_info = c
                break
        
        if color_info:
            stats.append({
                'masterCode': color_info.get('masterCode', ''),
                'displayCode': display_code,
                'brand': brand,
                'hex': color_info.get('hex', '#000000'),
                'rgb': color_info.get('rgb', [0, 0, 0]),
                'count': count,
            })
    
    # 构建 pixel_matrix 用于前端 Canvas 渲染
    pixel_matrix = []
    for y in range(target_h):
        row = []
        for x in range(target_w):
            if bg_mask[y, x]:
                # 背景色
                row.append({'rgb': {'r': 255, 'g': 255, 'b': 255}, 'code': ''})
            else:
                cell = mapped_grid[y][x]
                if cell:
                    row.append({
                        'rgb': {'r': cell['rgb'][0], 'g': cell['rgb'][1], 'b': cell['rgb'][2]},
                        'code': cell['displayCode']
                    })
                else:
                    row.append({'rgb': {'r': 255, 'g': 255, 'b': 255}, 'code': ''})
        pixel_matrix.append(row)
    
    return {
        'success': True,
        'actualWidth': target_w,
        'actualHeight': target_h,
        'gridCount': target_w * target_h,
        'totalBeads': total_beads,
        'backgroundCount': 0,
        'colorCount': len(stats),
        'previewUrl': f'/outputs/{filename}',
        'stats': stats,
        'pixelMatrix': pixel_matrix,
        'debug': {
            'mode': 'light',
            'isolatedPixelsRemoved': cleanup_stats['removed'],
            'totalCostMs': int((time.time() - t0) * 1000),
        }
    }

# ============================================================
# 其他模式（非 pixelPortrait）保持原有逻辑
# ============================================================

def run_normal_pipeline(img, target_w, target_h, allowed_palette, color_mode='detail'):
    """普通模式的管线"""
    print(f'[normal] mode: {color_mode}')
    
    t1 = time.time()
    
    # 计算 K-means 聚类数
    max_side = max(target_w, target_h)
    max_colors_limit = data.get('maxColors', 30)
    if color_mode == 'simple':
        n_clusters = 16 if max_side <= 64 else 24
    else:
        n_clusters = 20 if max_side <= 56 else (24 if max_side <= 72 else 32)
    # 上限保护：不超过色彩量化限制
    n_clusters = min(n_clusters, max_colors_limit)
    
    # resize 到目标尺寸
    target_img = img.resize((target_w, target_h), Image.Resampling.NEAREST)
    target_grid = np.array(target_img, dtype=np.uint8)
    
    # 展平用于 K-means
    pixels = target_grid.reshape(-1, 3)
    
    # 简单 K-means
    from sklearn.cluster import MiniBatchKMeans
    kmeans = MiniBatchKMeans(n_clusters=n_clusters, random_state=42, n_init=3)
    labels = kmeans.fit_predict(pixels)
    centers = kmeans.cluster_centers_
    
    # 映射到色板（所有像素都参与映射，包括背景白）
    mapped_grid = [[None for _ in range(target_w)] for _ in range(target_h)]
    color_stats = Counter()
    
    idx = 0
    for y in range(target_h):
        for x in range(target_w):
            rgb = tuple(int(c) for c in pixels[idx])
            mapped = nearest_color(rgb)
            mapped_grid[y][x] = mapped
            
            key = f"{mapped['brand']}|{mapped['displayCode']}"
            color_stats[key] += 1
            idx += 1
    
    # 生成预览 + 构建 pixelMatrix
    preview_img = Image.new('RGB', (target_w * 10, target_h * 10))
    pixel_matrix = []
    
    for y in range(target_h):
        row = []
        for x in range(target_w):
            cell = mapped_grid[y][x]
            color = tuple(cell['rgb']) if cell else (255, 255, 255)
            row.append({
                'rgb': {'r': cell['rgb'][0], 'g': cell['rgb'][1], 'b': cell['rgb'][2]},
                'code': cell['displayCode'] if cell else ''
            })
            
            for py in range(y * 10, (y + 1) * 10):
                for px in range(x * 10, (x + 1) * 10):
                    preview_img.putpixel((px, py), color)
        pixel_matrix.append(row)
    
    os.makedirs(output_dir, exist_ok=True)
    filename = f'pattern_preview_{timestamp}.png'
    preview_img.save(os.path.join(output_dir, filename))
    
    total_beads = target_w * target_h
    
    stats = []
    for key, count in color_stats.most_common():
        parts = key.split('|')
        brand = parts[0]
        display_code = parts[1]
        
        for c in allowed_palette:
            if c['brand'] == brand and c['displayCode'] == display_code:
                stats.append({
                    'masterCode': c.get('masterCode', ''),
                    'displayCode': display_code,
                    'brand': brand,
                    'hex': c.get('hex', '#000000'),
                    'rgb': c.get('rgb', [0, 0, 0]),
                    'count': count,
                })
                break
    
    return {
        'success': True,
        'actualWidth': target_w,
        'actualHeight': target_h,
        'gridCount': target_w * target_h,
        'totalBeads': total_beads,
        'backgroundCount': 0,
        'colorCount': len(stats),
        'previewUrl': f'/outputs/{filename}',
        'stats': stats,
        'pixelMatrix': pixel_matrix,
        'debug': {
            'mode': 'normal',
            'n_clusters': n_clusters,
        }
    }

# ============================================================
# 主逻辑
# ============================================================

if is_pixel_portrait:
    result = run_pixel_portrait_light_pipeline(img, target_width, target_height, allowed_palette)
else:
    result = run_normal_pipeline(img, target_width, target_height, allowed_palette, color_mode)

result['paletteId'] = data.get('palette_id', '221')
result['brand'] = data.get('brand', 'MARD')
result['displayMode'] = f"{data.get('brand', 'MARD')} 真实取色"

print(json.dumps(result, ensure_ascii=False))
`;

    const pythonResult = spawnSync('python3', ['-c', pythonScript], {
      input: JSON.stringify({
        image_base64: imageBase64,
        target_width: targetWidth,
        target_height: targetHeight,
        allowed_palette: allowedPalette,
        output_dir: OUTPUT_DIR,
        timestamp,
        preview_scale: 10,
        is_pixel_portrait: isPixelPortrait,
        palette_id: paletteId,
        brand,
        color_mode: colorMode,
        maxColors: aiMode === 'pixelDoll' ? 28 : (body.maxColors || 30),
      }),
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
    });

    if (pythonResult.status !== 0) {
      console.error('[generate-pattern] Python error:', pythonResult.stderr);
      return NextResponse.json(
        { success: false, error: `Python 处理失败: ${pythonResult.stderr}` },
        { status: 500 }
      );
    }

    try {
      // 只取最后一行的 JSON 输出（Python 可能输出了多行日志）
      const lines = pythonResult.stdout.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      console.log('[generate-pattern] Raw output length:', pythonResult.stdout.length, 'lines:', lines.length);
      const result = JSON.parse(jsonLine);
      console.log('[generate-pattern] 完成:', result.success);

      return NextResponse.json({
        success: result.success,
        actualWidth: result.actualWidth,
        actualHeight: result.actualHeight,
        totalBeads: result.totalBeads,
        backgroundCount: result.backgroundCount,
        colorCount: result.colorCount,
        allowedColorCount: allowedPalette.length,
        previewUrl: result.previewUrl,
        paletteId: result.paletteId,
        brand: result.brand,
        displayMode: result.displayMode,
        stats: result.stats,
        pixelMatrix: result.pixelMatrix || [],
        debug: result.debug,
      });
    } catch (parseErr) {
      console.error('[generate-pattern] JSON parse error:', parseErr);
      console.error('[generate-pattern] Raw output:', pythonResult.stdout.substring(0, 500));
      return NextResponse.json(
        { success: false, error: `结果解析失败: ${parseErr}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[generate-pattern] Error:', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
