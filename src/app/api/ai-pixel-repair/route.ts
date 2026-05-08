import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import { mkdir, writeFileSync } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 输出目录
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'outputs');

// 确保目录存在
if (!existsSync(OUTPUT_DIR)) {
  mkdir(OUTPUT_DIR, { recursive: true }).catch(console.error);
}

// Python 脚本（支持 color_mode 参数）
const PYTHON_SCRIPT = `
import sys
import json
import io
import numpy as np
from PIL import Image

data = json.load(sys.stdin)

# 接收图片数据（base64 编码）
image_base64 = data['image_base64']
target_width = data['target_width']
target_height = data['target_height']
max_side = data.get('max_side', max(target_width, target_height))
cleanup_morph = data.get('cleanup_morph', True)
cleanup_jaggy = data.get('cleanup_jaggy', True)
white_background = data.get('white_background', True)
color_mode = data.get('color_mode', 'detail')  # detail=细节优先, simple=简洁优先

print("=" * 50)
print("第二段：像素修复")
print("=" * 50)
print(f"目标尺寸: {target_width} x {target_height}")
print(f"最大边长: {max_side}")
print(f"限色模式: {color_mode}")
print("=" * 50)

try:
    # 1. 从 base64 解码图片
    print("[1] 解码图片数据...")
    import base64
    img_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
    img_array = np.array(img)
    h, w = img_array.shape[:2]
    print(f"    图片尺寸: {w} x {h}")
    
    # 2. 白底合成
    print("[2] 白底合成...")
    if img_array.shape[2] == 4:  # RGBA
        alpha = img_array[:, :, 3:4] / 255.0
        rgb = img_array[:, :, :3]
        white_bg = np.ones_like(rgb) * 255
        img_array = (rgb * alpha + white_bg * (1 - alpha)).astype(np.uint8)
    
    # 3. 主体检测（简单的基于颜色的检测）
    print("[3] 主体检测...")
    # 转换到灰度图
    gray = np.mean(img_array, axis=2)
    # 计算颜色变化梯度
    grad_x = np.abs(np.diff(gray, axis=1))
    grad_y = np.abs(np.diff(gray, axis=0))
    # 边缘检测阈值
    threshold = 20
    edge_x = np.concatenate([grad_x, np.zeros((h, 1))], axis=1) > threshold
    edge_y = np.concatenate([grad_y, np.zeros((1, w))], axis=0) > threshold
    edges = edge_x | edge_y
    
    # 找边缘包围的区域
    mask = np.zeros((h, w), dtype=bool)
    mask[edges] = True
    
    # 填充小的噪点
    from scipy.ndimage import binary_fill_holes
    mask = binary_fill_holes(mask)
    
    # bbox
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any() or not cols.any():
        # 如果检测失败，使用全图
        y1, y2 = 0, h
        x1, x2 = 0, w
    else:
        y1, y2 = np.where(rows)[0][[0, -1]]
        x1, x2 = np.where(cols)[0][[0, -1]]
    
    # 添加 padding
    pad_y = int((y2 - y1) * 0.1)
    pad_x = int((x2 - x1) * 0.1)
    y1 = max(0, y1 - pad_y)
    y2 = min(h, y2 + pad_y)
    x1 = max(0, x1 - pad_x)
    x2 = min(w, x2 + pad_x)
    
    print(f"    主体区域: ({x1}, {y1}) - ({x2}, {y2})")
    
    # 4. bbox 裁剪
    print("[4] BBox 裁剪...")
    cropped = img_array[y1:y2, x1:x2]
    ch, cw = cropped.shape[:2]
    print(f"    裁剪后: {cw} x {ch}")
    
    # 5. 按目标比例二次裁切
    target_ratio = target_width / target_height
    current_ratio = cw / ch
    
    if current_ratio > target_ratio:
        # 图片太宽，裁剪宽度
        new_w = int(ch * target_ratio)
        offset = (cw - new_w) // 2
        cropped = cropped[:, offset:offset + new_w]
    elif current_ratio < target_ratio:
        # 图片太高，裁剪高度
        new_h = int(cw / target_ratio)
        offset = (ch - new_h) // 2
        cropped = cropped[offset:offset + new_h, :]
    
    print(f"    比例调整后: {cropped.shape[1]} x {cropped.shape[0]}")
    
    # 6. BOX 缩放到目标尺寸
    print(f"[5] 缩放到目标尺寸 {target_width} x {target_height}...")
    img_resized = Image.fromarray(cropped).resize(
        (target_width, target_height),
        Image.Resampling.BOX
    )
    target_array = np.array(img_resized)
    
    # 7. K-means 限色（根据 color_mode 调整颜色数）
    print("[6] K-means 限色...")
    
    # 根据 maxSide 和 color_mode 确定颜色数
    if color_mode == 'simple':
        # 简洁优先：使用较少的颜色，更干净
        if max_side <= 56:
            n_colors = 12  # 小尺寸用12色更干净
        elif max_side <= 80:
            n_colors = 16
        else:
            n_colors = 20
    else:
        # 细节优先：保留更多颜色
        if max_side <= 56:
            n_colors = 16
        elif max_side <= 80:
            n_colors = 20
        else:
            n_colors = 24
    
    print(f"    使用颜色数: {n_colors} ({color_mode}模式)")
    
    # 创建主体 mask（全1，假设裁剪后都是主体）
    subject_mask = np.ones((target_height, target_width), dtype=bool)
    
    # 使用 sklearn 进行颜色量化
    from sklearn.cluster import MiniBatchKMeans
    
    pixels = target_array.reshape(-1, 3).astype(np.float32)
    mask_flat = subject_mask.flatten()
    
    # 正确的索引处理方式
    kmeans = MiniBatchKMeans(n_clusters=n_colors, random_state=42, n_init=10)
    
    # 只对主体区域进行聚类
    subject_pixels = pixels[mask_flat]
    kmeans.fit(subject_pixels)
    
    # 创建量化结果
    quantized = np.zeros_like(pixels)
    labels = kmeans.predict(pixels)
    centers = kmeans.cluster_centers_.astype(np.uint8)
    
    # 正确使用索引
    for i in range(len(pixels)):
        if mask_flat[i]:
            quantized[i] = centers[labels[i]]
        else:
            # 背景保持白色
            quantized[i] = [255, 255, 255]
    
    result = quantized.reshape(target_height, target_width, 3).astype(np.uint8)
    
    # 8. Morph 去杂点
    if cleanup_morph:
        print("[7] Morph 去杂点...")
        from scipy.ndimage import binary_opening, binary_closing, binary_dilation, binary_erosion
        from skimage.morphology import disk
        
        clean_result = result.copy()
        
        # 对每个通道分别处理孤立点
        for c in range(3):
            channel = clean_result[:, :, c]
            # 检测孤立点（周围都是相同颜色）
            for r in range(1, target_height - 1):
                for col in range(1, target_width - 1):
                    center_val = channel[r, col]
                    # 检查周围4邻域
                    neighbors = [
                        channel[r-1, col],
                        channel[r+1, col],
                        channel[r, col-1],
                        channel[r, col+1]
                    ]
                    # 如果中心与所有邻域都不同，可能是噪点
                    if all(n != center_val for n in neighbors):
                        # 使用邻域的众数
                        vals, counts = np.unique(neighbors, return_counts=True)
                        if len(vals) > 0:
                            channel[r, col] = vals[np.argmax(counts)]
        
        result = clean_result
    
    # 9. Jaggy 边缘修复
    if cleanup_jaggy:
        print("[8] Jaggy 边缘修复...")
        clean_jaggy = result.copy()
        
        for r in range(1, target_height - 1):
            for col in range(1, target_width - 1):
                center = result[r, col]
                # 检测是否是锯齿（对角线同色但与中心不同）
                diag1 = result[r-1, col-1]
                diag2 = result[r+1, col+1]
                diag3 = result[r-1, col+1]
                diag4 = result[r+1, col-1]
                
                # 如果两条对角线的颜色相同，但与中心不同
                if np.array_equal(diag1, diag2) and not np.array_equal(diag1, center):
                    clean_jaggy[r, col] = diag1
                elif np.array_equal(diag3, diag4) and not np.array_equal(diag3, center):
                    clean_jaggy[r, col] = diag3
        
        result = clean_jaggy
    
    # 10. NEAREST 放大 8 倍生成预览图
    print("[9] 生成 8 倍预览图...")
    preview_img = Image.fromarray(result).resize(
        (target_width * 8, target_height * 8),
        Image.Resampling.NEAREST
    )
    
    # 11. 保存结果
    timestamp = data.get('timestamp', 0)
    output_dir = data.get('output_dir', '/tmp')
    
    pixel_filename = f"pixel_{timestamp}.png"
    preview_filename = f"pixel_preview_{timestamp}.png"
    
    pixel_path = f"{output_dir}/{pixel_filename}"
    preview_path = f"{output_dir}/{preview_filename}"
    
    Image.fromarray(result).save(pixel_path)
    preview_img.save(preview_path)
    
    print(f"    像素图: {pixel_path}")
    print(f"    预览图: {preview_path}")
    
    # 12. 统计实际颜色数
    unique_colors = len(np.unique(result.reshape(-1, 3), axis=0))
    
    result_data = {
        'success': True,
        'pixel_path': pixel_path,
        'preview_path': preview_path,
        'colors': unique_colors,
        'n_colors_used': n_colors,
        'pixel_size': {
            'width': target_width,
            'height': target_height
        }
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
 * 第二段：像素修复
 * 
 * POST /api/ai-pixel-repair
 * 
 * 请求：
 * {
 *   "image_url": "第一段输出图片URL",
 *   "target_width": 41,
 *   "target_height": 61,
 *   "max_side": 61,
 *   "cleanup_morph": true,
 *   "cleanup_jaggy": true,
 *   "white_background": true
 * }
 * 
 * 返回：
 * {
 *   "success": true,
 *   "image": "像素图URL",
 *   "preview": "预览图URL",
 *   "width": 41,
 *   "height": 61,
 *   "colors": 16,
 *   "pixel_size": { "width": 41, "height": 61 }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      image_url,
      target_width,
      target_height,
      max_side,
      cleanup_morph = true,
      cleanup_jaggy = true,
      white_background = true
    } = body;

    console.log('='.repeat(50));
    console.log('[ai-pixel-repair] 第二段：像素修复');
    console.log('[ai-pixel-repair] 输入图片:', image_url);
    console.log('[ai-pixel-repair] 目标尺寸:', target_width, 'x', target_height);
    console.log('[ai-pixel-repair] maxSide:', max_side);
    console.log('='.repeat(50));

    // 1. 基础参数校验
    if (!image_url) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL (image_url)'
      }, { status: 400 });
    }

    if (!target_width || !target_height) {
      return NextResponse.json({
        success: false,
        error: '缺少尺寸参数 target_width, target_height'
      }, { status: 400 });
    }

    // 计算 maxSide
    const actualMaxSide = max_side || Math.max(target_width, target_height);

    // 2. 确保输出目录存在
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    // 3. 使用 Node.js fetch 下载图片（避免 spawnSync 网络限制）
    console.log('[ai-pixel-repair] 下载图片...');
    const startDownload = Date.now();
    
    let imageResponse: Response;
    try {
      imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        throw new Error(`下载失败: ${imageResponse.status}`);
      }
    } catch (err: any) {
      console.error('[ai-pixel-repair] 图片下载失败:', err.message);
      return NextResponse.json({
        success: false,
        error: `图片下载失败: ${err.message}`
      }, { status: 500 });
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const imageBase64 = imageBuffer.toString('base64');
    console.log('[ai-pixel-repair] 图片下载完成，大小:', imageBuffer.length, 'bytes，耗时:', Date.now() - startDownload, 'ms');

    // 4. 执行 Python 处理脚本
    const timestamp = Date.now();

    const inputData = JSON.stringify({
      image_base64: imageBase64,
      target_width,
      target_height,
      max_side: actualMaxSide,
      cleanup_morph,
      cleanup_jaggy,
      white_background,
      output_dir: OUTPUT_DIR,
      timestamp
    });

    console.log('[ai-pixel-repair] 执行 Python 处理...');

    const result = spawnSync('python3', ['-c', PYTHON_SCRIPT], {
      input: inputData,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024,
      timeout: 120000
    });

    const output = result.stdout + result.stderr;
    const match = output.match(/RESULT:(\{.*\})/);

    if (!match) {
      console.error('[ai-pixel-repair] 无法解析结果:', output.slice(-500));
      return NextResponse.json({
        success: false,
        error: '处理脚本执行异常',
        debug: output.slice(-1000)
      }, { status: 500 });
    }

    const pythonResult = JSON.parse(match[1]);

    if (!pythonResult.success) {
      console.error('[ai-pixel-repair] Python 处理失败:', pythonResult.error);
      return NextResponse.json({
        success: false,
        error: pythonResult.error || '像素修复失败'
      }, { status: 500 });
    }

    // 4. 构建公网URL
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
    const pixelFilename = path.basename(pythonResult.pixel_path);
    const previewFilename = path.basename(pythonResult.preview_path);

    const imageUrl = `${baseUrl}/outputs/${pixelFilename}`;
    const previewUrl = `${baseUrl}/outputs/${previewFilename}`;

    console.log('[ai-pixel-repair] 处理成功');
    console.log('[ai-pixel-repair] 像素图:', imageUrl);
    console.log('[ai-pixel-repair] 预览图:', previewUrl);

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      image: imageUrl,
      preview: previewUrl,
      width: target_width,
      height: target_height,
      colors: pythonResult.colors,
      pixel_size: pythonResult.pixel_size
    });

  } catch (error) {
    console.error('[ai-pixel-repair] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
