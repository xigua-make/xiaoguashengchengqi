/**
 * 图片直接识别 API
 * 不经过 AI 生图，直接对上传的图片进行拼豆处理
 */
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      imageUrl, 
      targetWidth, 
      targetHeight, 
      colorMode = 'detail',
      aiMode = 'directProcess',
      paletteId,
      brand 
    } = body;

    // 验证参数
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: '缺少图片参数' },
        { status: 400 }
      );
    }

    // 确定实际尺寸
    const actualWidth = targetWidth || 52;
    const actualHeight = targetHeight || 52;
    const totalBeads = actualWidth * actualHeight;

    // 根据尺寸和模式确定颜色数量
    const maxSide = Math.max(actualWidth, actualHeight);
    let maxColors = 24;
    if (colorMode === 'simple') {
      maxColors = maxSide <= 56 ? 12 : maxSide <= 72 ? 16 : 20;
    } else {
      maxColors = maxSide <= 56 ? 16 : maxSide <= 72 ? 20 : 24;
    }

    // 如果有颜色限制，使用较小的值
    const colorCount = maxColors;

    // 调用 Python 脚本处理图片
    const scriptPath = path.join(process.cwd(), 'scripts', 'direct-process.py');
    
    // 确保脚本目录存在
    const scriptDir = path.dirname(scriptPath);
    try {
      await fs.access(scriptDir);
    } catch {
      await fs.mkdir(scriptDir, { recursive: true });
    }

    // 创建临时 Python 脚本
    const pythonScript = `
#!/usr/bin/env python3
"""
图片直接识别处理脚本
直接从图片提取颜色并生成拼豆图纸
"""
import sys
import base64
import io
import json
from PIL import Image
import numpy as np
from collections import Counter

def hex_to_rgb(hex_color):
    """将十六进制颜色转换为 RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    """将 RGB 转换为十六进制颜色"""
    return '#{:02x}{:02x}{:02x}'.format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def enhance_outlines(rgb):
    """轮廓增强：深色吸附到纯黑，防止线条发虚"""
    r, g, b = rgb
    # 如果 RGB 三值都小于 80，直接判定为黑色
    if r < 80 and g < 80 and b < 80:
        return (0, 0, 0)
    return rgb

def color_distance(c1, c2):
    """计算两个颜色之间的红均值加权距离"""
    rmean = (c1[0] + c2[0]) / 2
    dr = c1[0] - c2[0]
    dg = c1[1] - c2[1]
    db = c1[2] - c2[2]
    # 使用红均值加权公式
    return np.sqrt(
        (((512 + rmean) * dr * dr) >> 8) + 
        4 * dg * dg + 
        (((767 - rmean) * db * db) >> 8)
    )

def find_nearest_color(target_rgb, palette):
    """在调色板中找到最接近目标颜色的颜色"""
    # Step 1: 轮廓增强（深色吸附到纯黑）
    target_rgb = enhance_outlines(target_rgb)
    
    palette_keys = list(palette.keys())
    palette_array = np.array(list(palette.values()))
    target = np.array(target_rgb)
    
    # 计算红均值权重
    rmean = (palette_array[:, 0] + target[0]) / 2
    dr = palette_array[:, 0] - target[0]
    dg = palette_array[:, 1] - target[1]
    db = palette_array[:, 2] - target[2]
    
    # 加权计算
    weights_r = 2 + rmean / 256
    weights_g = 4
    weights_b = 2 + (255 - rmean) / 256
    
    distances = np.sqrt(weights_r * dr**2 + weights_g * dg**2 + weights_b * db**2)
    nearest_idx = np.argmin(distances)
    return palette_keys[nearest_idx]

def quantize_colors(colors, max_colors):
    """使用简单的颜色量化"""
    if len(colors) <= max_colors:
        return list(colors)
    
    # 使用 K-means 简化的颜色量化
    color_list = list(colors)
    centroids = []
    
    # 初始中心点选择
    indices = np.linspace(0, len(color_list) - 1, max_colors, dtype=int)
    centroids = [color_list[i] for i in indices]
    
    # 迭代优化
    for _ in range(10):
        clusters = [[] for _ in range(max_colors)]
        for color in color_list:
            distances = [color_distance(color, c) for c in centroids]
            cluster_idx = np.argmin(distances)
            clusters[cluster_idx].append(color)
        
        new_centroids = []
        for i, cluster in enumerate(clusters):
            if cluster:
                new_centroids.append(np.mean(cluster, axis=0))
            else:
                new_centroids.append(centroids[i])
        centroids = new_centroids
    
    return [tuple(c) for c in centroids]

def merge_infrequent_colors(matrix_data, min_count=5):
    """合并低频色（解决1颗、2颗问题）"""
    # 统计数量
    color_counts = {}
    for row in matrix_data:
        for cell in row:
            code = cell['code']
            color_counts[code] = color_counts.get(code, 0) + 1
            
    # 找到稀有色
    rare_codes = [code for code, count in color_counts.items() if count < min_count]
    if not rare_codes:
        return matrix_data
        
    # 找到常用色数据作为候选
    frequent_colors = []
    for row in matrix_data:
        for cell in row:
            if cell['code'] not in rare_codes:
                frequent_colors.append(cell)
    
    if not frequent_colors:
        return matrix_data

    # 替换逻辑
    for y in range(len(matrix_data)):
        for x in range(len(matrix_data[0])):
            if matrix_data[y][x]['code'] in rare_codes:
                target_rgb = matrix_data[y][x]['rgb']
                # 寻找最接近的常用色 (使用加权距离逻辑)
                best_match = min(frequent_colors, key=lambda c: color_distance(target_rgb, c['rgb']))
                matrix_data[y][x] = {**best_match, 'x': x, 'y': y}
                
    return matrix_data

def process_with_brand_limit(matrix_data, brand_palette, max_colors=16):
    """
    品牌内限色：从选定品牌的完整色卡中，筛选出最适合本图的 16 个颜色
    """
    # 1. 统计频率
    counts = {}
    for row in matrix_data:
        for cell in row:
            code = cell['code']
            counts[code] = counts.get(code, 0) + 1
    
    # 2. 找出频率最高的 N 个色号
    top_codes = sorted(counts, key=counts.get, reverse=True)[:max_colors]
    
    # 3. 建立这 16 色的参考数据
    final_ref = {code: brand_palette[code] for code in top_codes if code in brand_palette}

    # 4. 全图归一化
    for y in range(len(matrix_data)):
        for x in range(len(matrix_data[0])):
            if matrix_data[y][x]['code'] not in top_codes:
                target_rgb = matrix_data[y][x]['rgb']
                best_code = find_nearest_color(target_rgb, final_ref)
                matrix_data[y][x]['code'] = best_code
                matrix_data[y][x]['rgb'] = final_ref.get(best_code, target_rgb)
                
    return matrix_data

def apply_mode_smoothing(matrix_data):
    """众数滤波：3x3邻域内少数服从多数"""
    rows = len(matrix_data)
    cols = len(matrix_data[0]) if rows > 0 else 0
    
    if rows < 3 or cols < 3:
        return matrix_data
    
    # 创建颜色查找表
    color_lookup = {}
    for row in matrix_data:
        for cell in row:
            if cell['code'] not in color_lookup:
                color_lookup[cell['code']] = cell
    
    result = [[matrix_data[y][x] for x in range(cols)] for y in range(rows)]
    
    for y in range(1, rows - 1):
        for x in range(1, cols - 1):
            # 统计 3x3 邻域的颜色频率
            from collections import Counter
            neighborhood_codes = []
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    neighborhood_codes.append(matrix_data[y + dy][x + dx]['code'])
            
            counter = Counter(neighborhood_codes)
            winner_code = counter.most_common(1)[0][0]
            
            # 替换为赢家的颜色数据
            if winner_code in color_lookup:
                result[y][x] = {**color_lookup[winner_code], 'x': x, 'y': y}
    
    return result

def process_image(image_base64, target_width, target_height, max_colors):
    """处理图片生成拼豆图纸"""
    # 解码图片
    image_data = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_data))
    
    # 转换为 RGB 模式
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # 缩小到目标尺寸（使用最近邻插值保持像素感）
    small_image = image.resize((target_width, target_height), Image.Resampling.NEAREST)
    
    # 获取所有像素颜色
    pixels = np.array(small_image)
    all_colors = [tuple(pixels[i, j]) for i in range(target_height) for j in range(target_width)]
    
    # 量化颜色
    unique_colors = list(set(all_colors))
    quantized_colors = quantize_colors(unique_colors, max_colors)
    palette = {rgb_to_hex(c): c for c in quantized_colors}
    
    # 将每个像素映射到调色板中最接近的颜色
    result_pixels = []
    for color in all_colors:
        nearest = find_nearest_color(color, palette)
        result_pixels.append(palette[nearest])
    
    # 重塑为图片
    result_array = np.array(result_pixels).reshape(target_height, target_width, 3).astype(np.uint8)
    result_image = Image.fromarray(result_array, 'RGB')
    
    # 放大回原尺寸（用于展示）
    display_size = (target_width * 10, target_height * 10)
    display_image = result_image.resize(display_size, Image.Resampling.NEAREST)
    
    # 添加网格线
    from PIL import ImageDraw
    draw = ImageDraw.Draw(display_image)
    
    # 绘制网格
    grid_color = (200, 200, 200)  # 浅灰色
    for i in range(target_height + 1):
        y = i * 10
        draw.line([(0, y), (display_size[0], y)], fill=grid_color, width=1)
    for j in range(target_width + 1):
        x = j * 10
        draw.line([(x, 0), (x, display_size[1])], fill=grid_color, width=1)
    
    # 返回结果
    output_buffer = io.BytesIO()
    display_image.save(output_buffer, format='PNG')
    output_base64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
    
    # 统计颜色使用情况
    color_counts = Counter(result_pixels)
    stats = []
    for hex_color, count in color_counts.items():
        stats.append({
            'hex': rgb_to_hex(hex_color) if isinstance(hex_color, (list, tuple)) else hex_color,
            'count': count
        })
    
    return {
        'image': f'data:image/png;base64,{output_base64}',
        'stats': stats
    }

if __name__ == '__main__':
    try:
        # 从 stdin 读取参数
        input_data = json.loads(sys.stdin.read())
        
        image_base64 = input_data.get('imageBase64', '')
        target_width = input_data.get('targetWidth', 52)
        target_height = input_data.get('targetHeight', 52)
        max_colors = input_data.get('maxColors', 24)
        
        result = process_image(image_base64, target_width, target_height, max_colors)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
`;

    // 写入脚本
    await fs.writeFile(scriptPath, pythonScript);

    // 执行 Python 脚本
    const inputData = JSON.stringify({
      imageBase64: imageUrl,
      targetWidth: actualWidth,
      targetHeight: actualHeight,
      maxColors: colorCount
    });

    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', [scriptPath], {
        input: inputData,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        // 清理临时脚本
        try {
          await fs.unlink(scriptPath);
        } catch {}

        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            
            if (result.error) {
              resolve(NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
              ));
              return;
            }

            resolve(NextResponse.json({
              success: true,
              previewUrl: result.image,
              actualWidth,
              actualHeight,
              totalBeads,
              colorCount: result.stats.length,
              colorMode,
              aiMode,
              paletteId: paletteId || 'direct',
              brand: brand || 'Direct',
              stats: result.stats
            }));
          } catch (parseError) {
            resolve(NextResponse.json(
              { success: false, error: '处理结果解析失败' },
              { status: 500 }
            ));
          }
        } else {
          console.error('Python script error:', stderr);
          resolve(NextResponse.json(
            { success: false, error: stderr || '处理失败' },
            { status: 500 }
          ));
        }
      });
    });
  } catch (error) {
    console.error('Direct process error:', error);
    return NextResponse.json(
      { success: false, error: '处理失败' },
      { status: 500 }
    );
  }
}
