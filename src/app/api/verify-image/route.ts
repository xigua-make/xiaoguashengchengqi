import { NextRequest, NextResponse } from 'next/server';

/**
 * 验证图片是否有效
 * 
 * 此接口保留用于调试，不是正式流程入口
 * 正式流程使用 /api/optimize-image
 * 
 * POST /api/verify-image
 * Body: {
 *   "imageUrl": "公网可访问的图片URL"
 * }
 */

// 验证脚本
const VERIFY_SCRIPT = `
import sys
import json
import requests
from PIL import Image
import io

data = json.load(sys.stdin)
image_url = data['image_url']

print("=" * 50)
print("验证图片")
print("=" * 50)
print(f"URL: {image_url}")

try:
    # 1. 下载图片
    resp = requests.get(image_url, timeout=120)
    if resp.status_code != 200:
        print(f"下载失败: HTTP {resp.status_code}")
        sys.exit(1)
    
    content = resp.content
    print(f"文件大小: {len(content)} bytes")
    
    if len(content) < 1000:
        print("文件太小，可能是错误页面")
        sys.exit(1)
    
    # 2. 尝试打开图片
    img = Image.open(io.BytesIO(content))
    width, height = img.size
    print(f"图片尺寸: {width} x {height}")
    
    if width < 64 or height < 64:
        print("图片尺寸太小")
        sys.exit(1)
    
    # 3. 检查是否为空白图
    img_small = img.resize((64, 64))
    pixels = list(img_small.getdata())
    
    # 计算颜色变化
    unique_colors = len(set(pixels[:100]))
    print(f"前100像素唯一颜色数: {unique_colors}")
    
    if unique_colors < 10:
        print("可能是空白图")
        sys.exit(1)
    
    print("验证通过!")
    print("RESULT:{\"success\": true, \"width\": " + str(width) + ", \"height\": " + str(height) + "}")
    
except Exception as e:
    print(f"验证失败: {e}")
    print("RESULT:{\"success\": false, \"error\": \"" + str(e) + "\"}")
`;

/**
 * 验证图片是否有效
 * 
 * POST /api/verify-image
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL'
      }, { status: 400 });
    }

    // 直接使用 Node.js 下载验证（更简单）
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `下载失败: HTTP ${response.status}`
      }, { status: 400 });
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) < 1000) {
      return NextResponse.json({
        success: false,
        error: '文件太小，可能是错误页面'
      }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();
    
    if (buffer.byteLength < 1000) {
      return NextResponse.json({
        success: false,
        error: '文件太小'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      size: buffer.byteLength,
      message: '图片有效'
    });

  } catch (error) {
    console.error('[verify-image] 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
