import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

// 临时图片存储目录
const TEMP_DIR = path.join(process.cwd(), 'public', 'temp-images');

// 最大文件大小：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * 上传临时图片并返回公网可访问URL
 * POST /api/temp-image
 * Content-Type: multipart/form-data
 * Field: image
 * 
 * 返回：
 * {
 *   "success": true,
 *   "imageUrl": "https://域名/temp-images/xxx.jpg",
 *   "width": 576,
 *   "height": 808
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 确保目录存在
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }

    // 解析 multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '缺少图片文件' },
        { status: 400 }
      );
    }

    // 校验文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '仅支持 JPG/PNG/WebP 格式' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 校验文件大小
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '图片不能超过10MB' },
        { status: 400 }
      );
    }

    // 生成唯一文件名
    const ext = file.type === 'image/png' ? 'png' 
               : file.type === 'image/webp' ? 'webp' 
               : 'jpg';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const filepath = path.join(TEMP_DIR, filename);

    // 保存图片
    await writeFile(filepath, buffer);

    // 使用 sharp 读取图片元数据
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // 构建公网URL
    const baseUrl = process.env.PUBLIC_BASE_URL || new URL(request.url).origin;
    const imageUrl = `${baseUrl}/temp-images/${filename}`;

    console.log(`[temp-image] 上传成功: ${filename}, ${width}x${height}`);

    return NextResponse.json({
      success: true,
      imageUrl,
      width,
      height,
      filename
    });

  } catch (error) {
    console.error('[temp-image] 上传失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}
