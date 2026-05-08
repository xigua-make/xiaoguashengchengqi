import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

// 临时图片存储目录
const TEMP_DIR = path.join(process.cwd(), 'public', 'temp-images');

// 确保目录存在
if (!existsSync(TEMP_DIR)) {
  mkdir(TEMP_DIR, { recursive: true }).catch(console.error);
}

/**
 * Q版底稿生成 - 兼容包装接口
 * 
 * 此接口保留用于兼容旧前端，实际主流程已改为：
 * /api/temp-image → /api/optimize-image
 * 
 * POST /api/qversion-generate
 * Content-Type: multipart/form-data
 * 
 * 字段：
 * - image: File
 * - target_width?: number
 * - target_height?: number  
 * - max_side?: number
 * - style?: string (可选，默认 pixelPortrait)
 * 
 * 返回旧格式：
 * {
 *   "success": true,
 *   "images": [outputImageUrl],
 *   "usage": {
 *     "model": "seedream-5.0-lite",
 *     "provider": "seedream",
 *     "aiMode": "pixelPortrait",
 *     "style": "pixelPortrait",
 *     "inputImageUrl": "...",
 *     "outputImageUrl": "...",
 *     "passedCheck": false,
 *     "checkReason": "兼容包装接口"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const targetWidth = parseInt(formData.get('target_width') as string) || 60;
    const targetHeight = parseInt(formData.get('target_height') as string) || 60;
    const maxSide = parseInt(formData.get('max_side') as string) || 60;
    const style = (formData.get('style') as string) || 'pixelPortrait';

    console.log('='.repeat(50));
    console.log('[qversion-generate] 兼容包装接口');
    console.log('[qversion-generate] Style:', style);
    console.log('[qversion-generate] Target Size:', targetWidth, 'x', targetHeight);
    console.log('='.repeat(50));

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '缺少图片文件'
      }, { status: 400 });
    }

    // ============================================
    // 步骤1：保存临时图片
    // ============================================
    console.log('[qversion-generate] 步骤1：保存临时图片...');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: '仅支持 JPG/PNG/WebP 格式'
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const filepath = path.join(TEMP_DIR, filename);

    await writeFile(filepath, buffer);

    const metadata = await sharp(buffer).metadata();
    const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
    const tempImageUrl = `${baseUrl}/temp-images/${filename}`;

    console.log('[qversion-generate] 临时图片:', tempImageUrl);

    // ============================================
    // 步骤2：调用 optimize-image
    // ============================================
    console.log('[qversion-generate] 步骤2：调用 optimize-image...');

    // 直接调用内部逻辑，避免额外的 HTTP 请求
    const { optimizePixelPortrait } = await import('@/lib/seedream');

    const seedreamResult = await optimizePixelPortrait({
      imageUrl: tempImageUrl,
      targetWidth,
      targetHeight,
      maxSide
    });

    if (!seedreamResult.success || !seedreamResult.outputImageUrl) {
      // 清理临时文件
      try { await unlink(filepath); } catch (e) {}
      
      return NextResponse.json({
        success: false,
        error: seedreamResult.error || 'AI 优化失败'
      }, { status: 500 });
    }

    let outputImageUrl = seedreamResult.outputImageUrl;

    // 如果返回的是本地路径，复制到公网目录
    const OUTPUT_DIR = path.join(process.cwd(), 'public', 'outputs');
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    if (outputImageUrl.startsWith('/') || outputImageUrl.startsWith('file://')) {
      const localPath = outputImageUrl.replace('file://', '');
      const newFilename = `qversion_${Date.now()}.png`;
      const destPath = path.join(OUTPUT_DIR, newFilename);
      
      try {
        await import('fs').then(fs => fs.promises.copyFile(localPath, destPath));
        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
        outputImageUrl = `${baseUrl}/outputs/${newFilename}`;
        
        // 删除原文件
        try { await unlink(localPath); } catch (e) {}
      } catch (e) {
        console.error('[qversion-generate] 复制文件失败:', e);
      }
    }

    // ============================================
    // 清理临时文件
    // ============================================
    try { await unlink(filepath); } catch (e) {}

    // ============================================
    // 返回旧格式
    // ============================================
    console.log('[qversion-generate] 完成，返回旧格式');
    console.log('[qversion-generate] Output URL:', outputImageUrl);

    return NextResponse.json({
      success: true,
      images: [outputImageUrl],
      usage: {
        model: 'seedream-5.0-lite',
        provider: 'seedream',
        aiMode: style,
        style: style,
        inputImageUrl: tempImageUrl,
        outputImageUrl: outputImageUrl,
        passedCheck: false,
        checkReason: '兼容包装接口，未执行真实视觉审核'
      }
    });

  } catch (error) {
    console.error('[qversion-generate] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
