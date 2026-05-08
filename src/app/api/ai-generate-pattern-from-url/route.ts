import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'outputs');

// 确保目录存在
if (!existsSync(OUTPUT_DIR)) {
  mkdir(OUTPUT_DIR, { recursive: true }).catch(console.error);
}

// ============================================
// MARD_221 色卡定义
// ============================================
const MARD_221_COLORS: Record<string, [number, number, number]> = {
  // A系列 - 白色/灰色/黑色
  'A01': [255, 255, 255], 'A02': [244, 244, 244], 'A03': [232, 232, 232],
  'A04': [220, 220, 220], 'A05': [208, 208, 208], 'A06': [196, 196, 196],
  'A07': [184, 184, 184], 'A08': [172, 172, 172], 'A09': [160, 160, 160],
  'A10': [148, 148, 148], 'A11': [136, 136, 136], 'A12': [124, 124, 124],
  'A13': [112, 112, 112], 'A14': [100, 100, 100], 'A15': [88, 88, 88],
  'A16': [76, 76, 76], 'A17': [64, 64, 64], 'A18': [52, 52, 52],
  'A19': [40, 40, 40], 'A20': [28, 28, 28], 'A21': [16, 16, 16], 'A22': [0, 0, 0],

  // B系列 - 红色系
  'B01': [255, 192, 203], 'B02': [255, 182, 193], 'B03': [238, 169, 184],
  'B04': [221, 155, 163], 'B05': [205, 142, 144], 'B06': [188, 128, 133],
  'B07': [171, 114, 121], 'B08': [155, 101, 102], 'B09': [139, 88, 83],
  'B10': [123, 76, 66], 'B11': [107, 64, 49], 'B12': [92, 52, 33],

  // C系列 - 粉红色系
  'C01': [255, 228, 225], 'C02': [255, 218, 213], 'C03': [255, 206, 200],
  'C04': [255, 194, 186], 'C05': [255, 183, 173], 'C06': [255, 171, 160],
  'C07': [255, 160, 148], 'C08': [255, 148, 135], 'C09': [255, 137, 123],
  'C10': [255, 126, 110], 'C11': [255, 115, 98], 'C12': [255, 104, 86],
  'C13': [255, 93, 74], 'C14': [255, 82, 62], 'C15': [255, 71, 50],
  'C16': [244, 60, 38], 'C17': [233, 50, 26], 'C18': [222, 40, 14],
  'C19': [211, 30, 2], 'C20': [200, 20, 0], 'C21': [189, 10, 0], 'C22': [178, 0, 0],

  // D系列 - 橙色系
  'D01': [255, 239, 213], 'D02': [255, 231, 197], 'D03': [255, 223, 181],
  'D04': [255, 215, 165], 'D05': [255, 207, 149], 'D06': [255, 199, 133],
  'D07': [255, 191, 117], 'D08': [255, 183, 101], 'D09': [255, 175, 85],
  'D10': [255, 167, 69], 'D11': [255, 159, 53], 'D12': [255, 151, 37],

  // E系列 - 黄色系
  'E01': [255, 255, 204], 'E02': [255, 255, 187], 'E03': [255, 255, 170],
  'E04': [255, 255, 153], 'E05': [255, 255, 136], 'E06': [255, 255, 119],
  'E07': [255, 255, 102], 'E08': [255, 255, 85], 'E09': [255, 255, 68],
  'E10': [255, 255, 51], 'E11': [255, 255, 34], 'E12': [255, 255, 17],

  // F系列 - 绿色系
  'F01': [204, 255, 204], 'F02': [187, 255, 187], 'F03': [170, 255, 170],
  'F04': [153, 255, 153], 'F05': [136, 255, 136], 'F06': [119, 255, 119],
  'F07': [102, 255, 102], 'F08': [85, 255, 85], 'F09': [68, 255, 68],
  'F10': [51, 255, 51], 'F11': [34, 255, 34], 'F12': [17, 255, 17],

  // G系列 - 蓝色系
  'G01': [204, 229, 255], 'G02': [187, 221, 255], 'G03': [170, 213, 255],
  'G04': [153, 204, 255], 'G05': [136, 196, 255], 'G06': [119, 188, 255],
  'G07': [102, 180, 255], 'G08': [85, 172, 255], 'G09': [68, 164, 255],
  'G10': [51, 156, 255], 'G11': [34, 148, 255], 'G12': [17, 140, 255],

  // H系列 - 紫色系
  'H01': [230, 230, 250], 'H02': [216, 216, 245], 'H03': [201, 201, 239],
  'H04': [187, 187, 233], 'H05': [173, 173, 227], 'H06': [159, 159, 221],
  'H07': [145, 145, 215], 'H08': [131, 131, 209], 'H09': [117, 117, 203],
  'H10': [103, 103, 197], 'H11': [89, 89, 191], 'H12': [75, 75, 185],

  // I系列 - 棕色系
  'I01': [255, 228, 196], 'I02': [245, 213, 175], 'I03': [235, 198, 154],
  'I04': [224, 183, 133], 'I05': [214, 168, 112], 'I06': [204, 153, 91],
  'I07': [194, 138, 70], 'I08': [184, 123, 49], 'I09': [173, 108, 28],
  'I10': [163, 93, 7], 'I11': [153, 78, 0], 'I12': [143, 63, 0],

  // J系列 - 肤色系
  'J01': [255, 248, 240], 'J02': [255, 237, 220], 'J03': [255, 227, 201],
  'J04': [255, 216, 181], 'J05': [255, 206, 162], 'J06': [255, 195, 143],
  'J07': [255, 185, 124], 'J08': [255, 174, 105], 'J09': [255, 164, 86],
  'J10': [255, 153, 67], 'J11': [255, 143, 48], 'J12': [255, 132, 29],

  // K系列 - 特殊色
  'K01': [255, 215, 0], 'K02': [255, 165, 0], 'K03': [255, 105, 180],
  'K04': [255, 20, 147], 'K05': [199, 21, 133], 'K06': [219, 112, 147],
  'K07': [255, 127, 80], 'K08': [255, 99, 71], 'K09': [255, 69, 0],
  'K10': [255, 228, 181], 'K11': [245, 222, 179], 'K12': [255, 250, 205],
};

// Python 脚本（不包含下载逻辑，由 Node.js 传递图片数据）
const PYTHON_SCRIPT = `
import sys
import json
import io
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import base64

data = json.load(sys.stdin)

# 接收图片数据（base64 编码）
image_base64 = data['image_base64']
bead_width = data['bead_width']
bead_height = data['bead_height']
show_grid = data.get('show_grid', True)
show_codes = data.get('show_codes', True)
cell_size = data.get('cell_size', 20)
timestamp = data.get('timestamp', 0)
output_dir = data.get('output_dir', '/tmp')

print("=" * 50)
print("第三段：拼豆图纸生成")
print("=" * 50)
print(f"像素尺寸: {bead_width} x {bead_height}")
print(f"色卡系统: MARD_221")
print("=" * 50)

try:
    # 1. 从 base64 解码图片
    print("[1] 解码图片数据...")
    img_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    
    # 确保尺寸正确
    if img.size != (bead_width, bead_height):
        img = img.resize((bead_width, bead_height), Image.Resampling.NEAREST)
    
    pixel_array = np.array(img)
    print(f"    尺寸: {img.size}")
    
    # 2. 构建 RGB 到色号的映射
    print("[2] 颜色匹配...")
    color_map = data['color_map']  # {'A01': [255, 255, 255], ...}
    
    # 创建 RGB 到色号的反向映射
    rgb_to_code = {}
    for code, rgb in color_map.items():
        rgb_to_code[tuple(rgb)] = code
    
    # 创建色卡颜色数组用于最近邻匹配
    palette_colors = np.array(list(color_map.values()), dtype=np.float32)
    palette_codes = list(color_map.keys())
    
    # 3. 对每个像素找到最近的 MARD 色号
    print("[3] 映射到 MARD_221 色卡...")
    
    result_array = np.zeros((bead_height, bead_width, 3), dtype=np.uint8)
    color_counts = {}
    
    for r in range(bead_height):
        for c in range(bead_width):
            pixel = pixel_array[r, c].astype(np.float32)
            
            # 计算与所有色卡颜色的欧氏距离
            distances = np.sqrt(np.sum((palette_colors - pixel) ** 2, axis=1))
            nearest_idx = np.argmin(distances)
            
            code = palette_codes[nearest_idx]
            result_array[r, c] = palette_colors[nearest_idx]
            color_counts[code] = color_counts.get(code, 0) + 1
    
    print(f"    使用颜色数: {len(color_counts)}")
    
    # 4. 生成带网格的展示图
    print("[4] 生成带网格展示图...")
    
    pattern_img = Image.new('RGB', (bead_width * cell_size, bead_height * cell_size), (255, 255, 255))
    draw = ImageDraw.Draw(pattern_img)
    
    # 绘制每个格子
    for r in range(bead_height):
        for c in range(bead_width):
            x1, y1 = c * cell_size, r * cell_size
            x2, y2 = x1 + cell_size, y1 + cell_size
            color = tuple(result_array[r, c])
            draw.rectangle([x1, y1, x2, y2], fill=color)
    
    # 绘制网格
    if show_grid:
        print("[5] 绘制网格...")
        for r in range(bead_height + 1):
            y = r * cell_size
            draw.line([(0, y), (bead_width * cell_size, y)], fill=(180, 180, 180), width=1)
        for c in range(bead_width + 1):
            x = c * cell_size
            draw.line([(x, 0), (x, bead_height * cell_size)], fill=(180, 180, 180), width=1)
    
    # 绘制色号
    if show_codes:
        print("[6] 绘制色号...")
        try:
            font_size = max(8, cell_size - 4)
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        for r in range(bead_height):
            for c in range(bead_width):
                code = palette_codes[np.argmin(np.sqrt(np.sum((palette_colors - result_array[r, c].astype(np.float32)) ** 2, axis=1)))]
                
                x = c * cell_size + cell_size // 2
                y = r * cell_size + cell_size // 2
                text = code[1:]  # 去掉字母前缀
                
                # 描边效果
                for dx, dy in [(-1,-1), (-1,1), (1,-1), (1,1)]:
                    draw.text((x + dx, y + dy), text, fill=(0, 0, 0), font=font, anchor='mm')
                draw.text((x, y), text, fill=(255, 255, 255), font=font, anchor='mm')
    
    # 5. 生成小图预览（无网格）
    print("[7] 生成小图预览...")
    small_img = Image.fromarray(result_array).resize(
        (bead_width * 4, bead_height * 4),
        Image.Resampling.NEAREST
    )
    
    # 6. 保存结果
    display_filename = f"pattern_display_{timestamp}.png"
    small_filename = f"pattern_small_{timestamp}.png"
    
    display_path = os.path.join(output_dir, display_filename)
    small_path = os.path.join(output_dir, small_filename)
    
    pattern_img.save(display_path)
    small_img.save(small_path)
    
    print(f"    展示图: {display_path}")
    print(f"    小图: {small_path}")
    
    # 7. 统计色号
    color_counts_list = [
        {'code': code, 'count': count}
        for code, count in sorted(color_counts.items(), key=lambda x: -x[1])
    ]
    
    # 8. 总珠子数
    total_beads = bead_width * bead_height
    print(f"    总珠子数: {total_beads}")
    
    result_data = {
        'success': True,
        'display_path': display_path,
        'small_path': small_path,
        'color_counts': color_counts_list,
        'total_beads': total_beads,
        'colors_used': len(color_counts)
    }
    print(f"RESULT:{json.dumps(result_data, ensure_ascii=False)}")
    
except Exception as e:
    import traceback
    print(f"ERROR: {e}")
    traceback.print_exc()
    result_data = {
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }
    print(f"RESULT:{json.dumps(result_data, ensure_ascii=False)}")
`;

/**
 * 第三段：拼豆图纸生成
 * 
 * POST /api/ai-generate-pattern-from-url
 * 
 * 请求：
 * {
 *   "image_url": "第二段小像素图URL",
 *   "bead_width": 41,
 *   "bead_height": 61,
 *   "color_system": "MARD_221",
 *   "show_grid": true,
 *   "show_codes": true,
 *   "cell_size": 20,
 *   "source": "pixelPortrait"
 * }
 * 
 * 返回：
 * {
 *   "success": true,
 *   "display_url": "展示图URL",
 *   "small_url": "小图URL",
 *   "color_system": "MARD_221",
 *   "color_counts": [{ "code": "A18", "count": 123 }],
 *   "total_beads": 2501,
 *   "width": 41,
 *   "height": 61,
 *   "pixel_size": { "width": 41, "height": 61 },
 *   "source": "pixelPortrait"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      image_url,
      bead_width,
      bead_height,
      color_system,
      show_grid = true,
      show_codes = true,
      cell_size = 20,
      source = 'pixelPortrait'
    } = body;

    console.log('='.repeat(50));
    console.log('[ai-generate-pattern] 第三段：拼豆图纸生成');
    console.log('[ai-generate-pattern] 输入图片:', image_url);
    console.log('[ai-generate-pattern] 像素尺寸:', bead_width, 'x', bead_height);
    console.log('[ai-generate-pattern] 色卡系统:', color_system);
    console.log('='.repeat(50));

    // ============================================
    // 1. 基础参数校验
    // ============================================

    if (!image_url) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL (image_url)'
      }, { status: 400 });
    }

    if (!bead_width || !bead_height) {
      return NextResponse.json({
        success: false,
        error: '缺少尺寸参数 bead_width, bead_height'
      }, { status: 400 });
    }

    // ============================================
    // 2. 统一颜色系统变量
    // ============================================
    const finalColorSystem = color_system || 'MARD_221';
    console.log('[ai-generate-pattern] 使用色卡:', finalColorSystem);

    // 目前仅支持 MARD_221
    if (finalColorSystem !== 'MARD_221') {
      return NextResponse.json({
        success: false,
        error: '目前仅支持 MARD_221 色卡'
      }, { status: 400 });
    }

    // ============================================
    // 3. 确保输出目录存在
    // ============================================
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    // ============================================
    // 4. 使用 Node.js fetch 下载图片（避免 spawnSync 网络限制）
    // ============================================
    console.log('[ai-generate-pattern] 下载图片...');
    const startDownload = Date.now();
    
    let imageResponse: Response;
    try {
      imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        throw new Error(`下载失败: ${imageResponse.status}`);
      }
    } catch (err: any) {
      console.error('[ai-generate-pattern] 图片下载失败:', err.message);
      return NextResponse.json({
        success: false,
        error: `图片下载失败: ${err.message}`
      }, { status: 500 });
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const imageBase64 = imageBuffer.toString('base64');
    console.log('[ai-generate-pattern] 图片下载完成，大小:', imageBuffer.length, 'bytes，耗时:', Date.now() - startDownload, 'ms');

    // ============================================
    // 5. 执行 Python 处理脚本
    // ============================================
    const timestamp = Date.now();

    const inputData = JSON.stringify({
      image_base64: imageBase64,
      bead_width,
      bead_height,
      show_grid,
      show_codes,
      cell_size,
      output_dir: OUTPUT_DIR,
      timestamp,
      // 传递色卡定义
      color_map: MARD_221_COLORS
    });

    console.log('[ai-generate-pattern] 执行 Python 处理...');

    const result = spawnSync('python3', ['-c', PYTHON_SCRIPT], {
      input: inputData,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
      timeout: 120000
    });

    const output = result.stdout + result.stderr;
    const match = output.match(/RESULT:(\{.*\})/);

    if (!match) {
      console.error('[ai-generate-pattern] 无法解析结果:', output.slice(-500));
      return NextResponse.json({
        success: false,
        error: '处理脚本执行异常',
        debug: output.slice(-1000)
      }, { status: 500 });
    }

    const pythonResult = JSON.parse(match[1]);

    if (!pythonResult.success) {
      console.error('[ai-generate-pattern] Python 处理失败:', pythonResult.error);
      return NextResponse.json({
        success: false,
        error: pythonResult.error || '图纸生成失败'
      }, { status: 500 });
    }

    // ============================================
    // 5. 构建公网URL
    // ============================================
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
    const displayFilename = path.basename(pythonResult.display_path);
    const smallFilename = path.basename(pythonResult.small_path);

    const displayUrl = `${baseUrl}/outputs/${displayFilename}`;
    const smallUrl = `${baseUrl}/outputs/${smallFilename}`;

    console.log('[ai-generate-pattern] 处理成功');
    console.log('[ai-generate-pattern] 展示图:', displayUrl);
    console.log('[ai-generate-pattern] 小图:', smallUrl);

    // ============================================
    // 6. 修复 total_beads 计算
    // ============================================
    const totalBeads = bead_width * bead_height;

    console.log('[ai-generate-pattern] 总珠子数:', totalBeads);

    // ============================================
    // 7. 返回结果
    // ============================================
    return NextResponse.json({
      success: true,
      display_url: displayUrl,
      small_url: smallUrl,
      color_system: finalColorSystem,
      color_counts: pythonResult.color_counts,
      total_beads: totalBeads,
      width: bead_width,
      height: bead_height,
      pixel_size: {
        width: bead_width,
        height: bead_height
      },
      source: source || 'pixelPortrait'
    });

  } catch (error) {
    console.error('[ai-generate-pattern] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
