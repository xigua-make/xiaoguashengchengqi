import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';

/**
 * 即梦AI图生图API - 使用coze-coding-ai CLI实现真正的图生图
 * 
 * POST /api/jimeng-img2img
 * Body: { 
 *   "imageUrl": "公网图片URL", 
 *   "prompt": "转换提示词",
 *   "size": "2K" | "4K"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, prompt, size = '2K' } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL'
      }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: '缺少提示词'
      }, { status: 400 });
    }

    console.log('=== 即梦AI图生图 ===');
    console.log('图片:', imageUrl.slice(0, 80));

    // 构建CLI命令
    // coze-coding-ai image -p "prompt" -i "image_url" -o "output.png" -s "2K"
    const outputPath = `/tmp/jimeng_${Date.now()}.png`;
    
    const cmd = [
      'npx', 'coze-coding-ai', 'image',
      '-p', prompt,
      '-i', imageUrl,
      '-o', outputPath,
      '-s', size
    ];

    console.log('执行命令:', cmd.join(' '));

    const result = spawnSync(cmd[0], cmd.slice(1), {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 180000,
      cwd: '/workspace/projects'
    });

    console.log('Return code:', result.returncode);
    console.log('STDOUT:', result.stdout?.slice(-500));
    console.log('STDERR:', result.stderr?.slice(-500));

    if (result.returncode !== 0) {
      return NextResponse.json({
        success: false,
        error: result.stderr || '生成失败',
        stdout: result.stdout
      }, { status: 500 });
    }

    // 检查输出文件
    const fs = await import('fs');
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({
        success: false,
        error: '输出文件不存在'
      }, { status: 500 });
    }

    // 读取生成的图片
    const imageData = fs.readFileSync(outputPath);
    const imageBase64 = imageData.toString('base64');
    
    console.log('生成成功，图片大小:', imageData.length);

    // 清理临时文件
    try {
      fs.unlinkSync(outputPath);
    } catch (e) {
      // ignore
    }

    return NextResponse.json({
      success: true,
      image_base64: `data:image/png;base64,${imageBase64}`,
      message: '图生图成功'
    });

  } catch (error) {
    console.error('API异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
