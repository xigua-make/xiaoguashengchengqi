import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

/**
 * 验证火山引擎 Seedream API 图生图字段
 * 
 * 这个接口用于调试，确认：
 * 1. image_url 字段是否被 API 支持
 * 2. 实际返回的数据结构
 * 3. 模型名是否正确
 * 
 * POST /api/debug-seedream
 * Body: {
 *   "imageUrl": "公网可访问的图片URL"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, prompt } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少图片URL'
      }, { status: 400 });
    }

    // 获取 API 配置
    const apiKey = process.env.SEEDREAM_API_KEY;
    const apiUrl = process.env.SEEDREAM_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: '缺少 SEEDREAM_API_KEY 环境变量'
      }, { status: 500 });
    }

    // 测试用的 prompt
    const testPrompt = prompt || '请严格基于输入图片编辑，不要改变人物数量、姿势、发型、服装和构图，只将照片处理成干净的人像插画风。';

    console.log('='.repeat(60));
    console.log('[debug-seedream] 开始测试火山引擎 API');
    console.log('[debug-seedream] API URL:', apiUrl);
    console.log('[debug-seedream] 参考图片:', imageUrl);
    console.log('[debug-seedream] 模型: doubao-seedream-5-0-260128');
    console.log('='.repeat(60));

    // ============================================
    // 测试1：使用 image_url 字段
    // ============================================
    console.log('[debug-seedream] 测试1：使用 image_url 字段');

    const payloadWithImageUrl = {
      model: 'doubao-seedream-5-0-260128',
      prompt: testPrompt,
      image_url: imageUrl,  // 可能的字段1
      size: '2K',
      response_format: 'url',
      stream: false,
      watermark: true
    };

    console.log('[debug-seedream] Payload:', JSON.stringify(payloadWithImageUrl, null, 2));

    let result1: any = null;
    let success1 = false;

    try {
      const response1 = await axios.post(apiUrl, payloadWithImageUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 120000
      });

      result1 = response1.data;
      console.log('[debug-seedream] 响应1状态:', response1.status);
      console.log('[debug-seedream] 响应1数据:', JSON.stringify(result1).slice(0, 500));
      success1 = true;
    } catch (error1: any) {
      console.error('[debug-seedream] 测试1失败:', error1.message);
      result1 = {
        error: error1.message,
        status: error1.response?.status,
        data: error1.response?.data
      };
    }

    // ============================================
    // 测试2：尝试其他可能的字段名
    // ============================================
    console.log('[debug-seedream] 测试2：尝试 image 字段');

    const possibleFields = [
      { name: 'image', value: imageUrl },
      { name: 'images', value: [imageUrl] },
      { name: 'input_image', value: imageUrl },
      { name: 'reference_image', value: imageUrl },
      { name: 'ref_image', value: imageUrl }
    ];

    const testResults: any[] = [];

    for (const field of possibleFields) {
      if (field.name === 'image_url') continue; // 已经测过了

      console.log(`[debug-seedream] 测试字段: ${field.name}`);

      const payload = {
        model: 'doubao-seedream-5-0-260128',
        prompt: testPrompt,
        [field.name]: field.value,
        size: '2K',
        response_format: 'url',
        stream: false,
        watermark: true
      };

      try {
        const response = await axios.post(apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 120000
        });

        console.log(`[debug-seedream] ${field.name} 响应:`, JSON.stringify(response.data).slice(0, 300));
        testResults.push({
          field: field.name,
          success: true,
          data: response.data
        });
      } catch (error: any) {
        console.error(`[debug-seedream] ${field.name} 失败:`, error.message);
        testResults.push({
          field: field.name,
          success: false,
          error: error.message
        });
      }
    }

    // ============================================
    // 返回调试信息
    // ============================================
    const debugInfo = {
      apiUrl,
      model: 'doubao-seedream-5-0-260128',
      testPrompt,
      inputImageUrl: imageUrl,
      
      // 测试1结果
      test1_image_url: {
        payload: payloadWithImageUrl,
        success: success1,
        response: result1,
        outputUrl: extractImageUrl(result1)
      },

      // 测试2结果
      test2_other_fields: testResults,

      // 汇总
      summary: {
        bestField: success1 ? 'image_url' : null,
        allFieldsTested: ['image_url', ...possibleFields.map(f => f.name)],
        recommendation: success1 
          ? 'image_url 字段可用，API 支持图生图模式'
          : '所有字段测试失败，请检查 API Key 和模型是否正确'
      }
    };

    console.log('[debug-seedream] 调试信息:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json({
      success: success1,
      ...debugInfo
    });

  } catch (error) {
    console.error('[debug-seedream] 异常:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 从响应中提取图片 URL
 */
function extractImageUrl(data: any): string | null {
  if (!data) return null;
  
  // 尝试各种可能的路径
  const paths = [
    data.output_image_url,
    data.outputImageUrl,
    data.data?.url,
    data.data?.[0]?.url,
    data.url,
    data.image_url,
    data.imageUrl,
    data.result?.url,
    data.results?.[0]?.url
  ];

  for (const url of paths) {
    if (typeof url === 'string' && url.startsWith('http')) {
      return url;
    }
  }

  return null;
}
