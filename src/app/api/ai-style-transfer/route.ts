import { NextRequest, NextResponse } from 'next/server';

/**
 * AI 风格转换接口
 * 
 * 此接口已废弃，请使用新的三段式流程：
 * - /api/temp-image (上传图片)
 * - /api/optimize-image (AI 优化)
 * - /api/ai-pixel-repair (像素修复)
 * - /api/ai-generate-pattern-from-url (生成图纸)
 * 
 * POST /api/ai-style-transfer
 * 
 * 返回错误提示，引导用户使用新流程
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '此接口已废弃',
    message: '请使用新的三段式流程：/api/temp-image → /api/optimize-image → /api/ai-pixel-repair → /api/ai-generate-pattern-from-url',
    migration: {
      step1: {
        method: 'POST',
        endpoint: '/api/temp-image',
        contentType: 'multipart/form-data',
        field: 'image',
        response: { imageUrl: '公网URL' }
      },
      step2: {
        method: 'POST',
        endpoint: '/api/optimize-image',
        contentType: 'application/json',
        body: {
          provider: 'seedream',
          aiMode: 'pixelPortrait',
          imageUrl: '来自步骤1',
          targetWidth: 60,
          targetHeight: 60,
          maxSide: 60
        }
      },
      step3: {
        method: 'POST',
        endpoint: '/api/ai-pixel-repair',
        body: {
          image_url: '来自步骤2的outputImageUrl',
          target_width: 60,
          target_height: 60,
          max_side: 60
        }
      },
      step4: {
        method: 'POST',
        endpoint: '/api/ai-generate-pattern-from-url',
        body: {
          image_url: '来自步骤3的image',
          bead_width: 60,
          bead_height: 60,
          color_system: 'MARD_221'
        }
      }
    }
  }, { status: 410 }); // 410 Gone
}
