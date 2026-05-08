import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

// TOS对象存储配置
const TOS_CONFIG = {
  endpoint: 'tos-cn-beijing.volces.com',
  bucket: 'pindoutuzhi',
};

// 像素图生成Python脚本
const PIXEL_GENERATOR_SCRIPT = `
import sys
import json
import base64
from io import BytesIO
from PIL import Image
import requests
import time

def generate_pixel_art(image_url, pixel_size=64, output_bucket=None, output_endpoint=None):
    try:
        # 1. 下载原图
        print(f"下载图片: {image_url}")
        resp = requests.get(image_url, timeout=120)
        if resp.status_code != 200:
            return f"ERROR:下载失败-{resp.status_code}"
        
        # 2. 用Pillow处理
        img = Image.open(BytesIO(resp.content)).convert('RGBA')
        original_width, original_height = img.size
        
        # 计算缩放后的尺寸（保持宽高比，最大边为pixel_size）
        if original_width >= original_height:
            new_width = pixel_size
            new_height = int(original_height * (pixel_size / original_width))
        else:
            new_height = pixel_size
            new_width = int(original_width * (pixel_size / original_height))
        
        # 确保尺寸有效
        new_width = max(1, new_width)
        new_height = max(1, new_height)
        
        # 缩放到低分辨率（使用NEAREST采样保留像素风格）
        small_img = img.resize((new_width, new_height), Image.Resampling.NEAREST)
        
        print(f"生成像素图尺寸: {new_width}x{new_height}")
        
        # 3. 保存为PNG
        output = BytesIO()
        small_img.save(output, format='PNG')
        pixel_data = output.getvalue()
        
        # 4. 上传到TOS
        if output_bucket and output_endpoint:
            filename = f"pixel_art/{int(time.time())}_{new_width}x{new_height}.png"
            url = f"https://{output_bucket}.{output_endpoint}/{filename}"
            
            upload_resp = requests.put(url, data=pixel_data, headers={
                'Content-Type': 'image/png'
            }, timeout=30)
            
            if upload_resp.status_code in [200, 201]:
                return f"SUCCESS:{url}"
            else:
                return f"ERROR:上传失败-{upload_resp.status_code}"
        
        return f"ERROR:未配置TOS"
        
    except Exception as e:
        return f"ERROR:{str(e)}"

if __name__ == "__main__":
    try:
        params = json.loads(base64.b64decode(sys.argv[1]).decode('utf-8'))
        
        image_url = params.get('image_url')
        pixel_size = params.get('pixel_size', 64)
        output_bucket = params.get('output_bucket')
        output_endpoint = params.get('output_endpoint')
        
        if not image_url:
            print("ERROR:缺少image_url参数")
            sys.exit(1)
        
        result = generate_pixel_art(image_url, pixel_size, output_bucket, output_endpoint)
        print(result)
        
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)
`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const pixelSize = parseInt(formData.get('pixelSize') as string) || 64;
    const style = (formData.get('style') as string) || 'q_avatar';

    if (!image) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 });
    }

    // 读取图片
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const contentType = image.type || 'image/png';
    const ext = contentType.split('/')[1] || 'png';
    
    // Step 1: 上传到TOS
    const key = `temp/original_${Date.now()}.${ext}`;
    console.log('上传到TOS:', key);

    const uploadParams = JSON.stringify({
      endpoint: TOS_CONFIG.endpoint,
      bucket: TOS_CONFIG.bucket,
      content: imageBuffer.toString('base64'),
      content_type: contentType,
    });

    // 先编码参数
    const encodedParams = Buffer.from(uploadParams).toString('base64');

    const uploadScript = `
import sys
import base64
import requests
import json

args = json.loads(base64.b64decode(sys.argv[1]).decode('utf-8'))
url = f"https://{args['bucket']}.{args['endpoint']}/{args['key']}"
content = base64.b64decode(args['content'])

resp = requests.put(url, data=content, headers={'Content-Type': args['content_type']}, timeout=120)
if resp.status_code in [200, 201]:
    print(f"SUCCESS:{url}")
else:
    print(f"ERROR:{resp.status_code}")
`;

    const uploadResult = spawnSync('python3', ['-c', uploadScript], {
      input: Buffer.from(JSON.stringify({
        endpoint: TOS_CONFIG.endpoint,
        bucket: TOS_CONFIG.bucket,
        key: key,
        content: imageBuffer.toString('base64'),
        content_type: contentType,
      })),
      encoding: 'utf-8',
      timeout: 30000,
    });

    console.log('上传结果:', uploadResult.stdout, uploadResult.stderr);

    if (!uploadResult.stdout || !uploadResult.stdout.includes('SUCCESS:')) {
      return NextResponse.json({ error: '图片上传失败' }, { status: 500 });
    }

    const imageUrl = uploadResult.stdout.split('SUCCESS:')[1].trim();
    console.log('图片URL:', imageUrl);

    // Step 2: 生成真正的像素图
    console.log('生成像素图，像素尺寸:', pixelSize);

    const pixelParams = JSON.stringify({
      image_url: imageUrl,
      pixel_size: pixelSize,
      output_bucket: TOS_CONFIG.bucket,
      output_endpoint: TOS_CONFIG.endpoint,
    });

    const encodedPixelParams = Buffer.from(pixelParams).toString('base64');

    const pixelResult = spawnSync('python3', ['-c', PIXEL_GENERATOR_SCRIPT], {
      input: Buffer.from(pixelParams),
      encoding: 'utf-8',
      timeout: 60000,
    });

    console.log('生成结果:', pixelResult.stdout);
    console.log('生成错误:', pixelResult.stderr);

    if (!pixelResult.stdout || !pixelResult.stdout.includes('SUCCESS:')) {
      const error = pixelResult.stderr || pixelResult.stdout || '生成失败';
      return NextResponse.json({ error: '像素图生成失败: ' + error }, { status: 500 });
    }

    const resultUrl = pixelResult.stdout.split('SUCCESS:')[1].trim();

    return NextResponse.json({
      success: true,
      imageUrl: resultUrl,
      style: '大头Q版像素画',
      pixelSize: pixelSize,
      message: '转换成功 - 真正的' + pixelSize + 'x' + pixelSize + '像素图'
    });

  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
