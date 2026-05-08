import { NextRequest, NextResponse } from 'next/server';
import { spawnSync } from 'child_process';

/**
 * 测试 Seedream 图生图是否真正使用输入图片
 * 
 * 此接口用于调试，不是正式流程入口
 * 
 * POST /api/test-model-edit
 * Body: {
 *   "imageUrl": "公网可访问的图片URL",
 *   "prompt": "可选的prompt"
 * }
 * 
 * 注意：正式主流程已改为 /api/optimize-image，不走此接口
 */

// ============================================
// 环境变量配置（必须）
// ============================================
function getApiConfig() {
  const apiKey = process.env.SEEDREAM_API_KEY;
  const apiUrl = process.env.SEEDREAM_API_URL;

  if (!apiKey || !apiUrl) {
    throw new Error('缺少 SEEDREAM_API_KEY 或 SEEDREAM_API_URL 环境变量');
  }

  return { apiKey, apiUrl };
}

// 测试脚本
const TEST_SCRIPT = `
import sys
import json
import requests
import time

data = json.load(sys.stdin)

api_url = data['api_url']
api_key = data['api_key']
image_url = data['image_url']
prompt = data.get('prompt', '保持图片中的人物和特征不变')

print("=" * 50)
print("测试 Seedream 图生图")
print("=" * 50)
print(f"API URL: {api_url}")
print(f"Image URL: {image_url}")
print(f"Prompt: {prompt}")
print("=" * 50)

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {api_key}'
}

# 提交任务
payload = {
    'model': 'seedream-5-0-lite',
    'prompt': prompt,
    'image_url': image_url,
    'size': '1K'
}

try:
    resp = requests.post(api_url, headers=headers, json=payload, timeout=120)
    result = resp.json()
    print(f"Response: {str(result)[:200]}")
    
    # 解析输出
    output_url = result.get('outputImageUrl') or result.get('image_url') or result.get('data', {}).get('image_url')
    
    if output_url:
        print(f"输出图片: {output_url}")
        sys.exit(0)
    else:
        print("未获取到输出图片")
        print(f"完整响应: {result}")
        sys.exit(1)
        
except Exception as e:
    print(f"错误: {e}")
    sys.exit(1)
`;

/**
 * 测试 Seedream 图生图
 * 
 * POST /api/test-model-edit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, prompt } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL (imageUrl)'
      }, { status: 400 });
    }

    // 获取 API 配置
    let apiKey: string, apiUrl: string;
    try {
      const config = getApiConfig();
      apiKey = config.apiKey;
      apiUrl = config.apiUrl;
    } catch (configError) {
      return NextResponse.json({
        success: false,
        error: '请先配置 SEEDREAM_API_KEY 和 SEEDREAM_API_URL 环境变量'
      }, { status: 500 });
    }

    console.log('[test-model-edit] 开始测试 Seedream...');
    console.log('[test-model-edit] Image URL:', imageUrl);

    const testPrompt = prompt || '保持图片中的人物和特征不变，进行简单的图像处理';

    const inputData = JSON.stringify({
      api_url: apiUrl,
      api_key: apiKey,
      image_url: imageUrl,
      prompt: testPrompt
    });

    const result = spawnSync('python3', ['-c', TEST_SCRIPT], {
      input: inputData,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 180000
    });

    const output = result.stdout + result.stderr;
    console.log('[test-model-edit] 脚本输出:', output.slice(-500));

    if (result.returncode !== 0) {
      return NextResponse.json({
        success: false,
        error: 'Seedream 测试失败',
        debug: output.slice(-1000)
      }, { status: 500 });
    }

    // 解析输出图片 URL
    const urlMatch = output.match(/输出图片[:\s]+(https?:\/\/[^\s]+)/);
    const outputUrl = urlMatch ? urlMatch[1] : null;

    return NextResponse.json({
      success: true,
      imageUrl: outputUrl,
      message: '测试完成'
    });

  } catch (error) {
    console.error('[test-model-edit] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
