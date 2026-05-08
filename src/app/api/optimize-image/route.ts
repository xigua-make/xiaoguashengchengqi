import { NextRequest, NextResponse } from 'next/server';
import {
  callSeedreamAPI,
  buildPrompt,
  saveGeneratedImage,
  DEFAULT_REFERENCE_IMAGE_PATH,
  getSizeForAiMode
} from '@/lib/seedream';
import { calculateOptimizeTargetSize, normalizeMaxSide, getPixelPortraitSpec } from '@/lib/pattern-size';

/**
 * 第一段：AI 优化底稿
 * 
 * 核心职责：
 * - 接收 aiMode、imageUrl
 * - 接收 targetWidth、targetHeight、targetSize（用于 pixelPortrait 模式）
 * - pixelPortrait 模式：自动使用默认风格参考图
 * - 根据 aiMode 和 targetSize 拼 prompt
 * - 调用 Seedream 生图
 * - 保存并返回 AI 图
 * 
 * POST /api/optimize-image
 * 
 * 请求体：
 * {
 *   aiMode: "pixelPortrait" | "pixelFullBody" | "pixelDoll" | "cartoon",
 *   imageUrl: "公网可访问的图片URL",
 *   referenceImageUrl: null | "参考图URL",
 *   targetWidth?: number,
 *   targetHeight?: number,
 *   targetSize?: number
 * }
 * 
 * 返回：
 * {
 *   success: boolean,
 *   provider: "seedream",
 *   mode: string,
 *   inputImageUrl: string,
 *   outputImageUrl: string,
 *   referenceImageUrl: string | null,
 *   debug: { ... }
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      aiMode = 'pixelPortrait',
      imageUrl,
      referenceImageUrl = null,
      targetWidth,
      targetHeight,
      targetSize
    } = body;

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: '缺少 imageUrl 参数'
      }, { status: 400 });
    }

    console.log('[optimize-image] ===== 开始处理 =====');
    console.log('[optimize-image] aiMode:', aiMode);
    console.log('[optimize-image] imageUrl:', imageUrl);
    console.log('[optimize-image] targetWidth:', targetWidth);
    console.log('[optimize-image] targetHeight:', targetHeight);
    console.log('[optimize-image] targetSize:', targetSize);

    // ============================================
    // 1. 计算目标尺寸
    // ============================================
    
    const effectiveTargetSize = normalizeMaxSide(targetSize);
    
    console.log('[optimize-image] effectiveTargetSize:', effectiveTargetSize);
    
    const effectiveTarget = calculateOptimizeTargetSize(aiMode, effectiveTargetSize);
    
    const pixelPortraitSpec = aiMode === 'pixelPortrait' ? getPixelPortraitSpec(effectiveTargetSize) : null;

    console.log('[optimize-image] effectiveTargetSize:', effectiveTargetSize);
    console.log('[optimize-image] effectiveTargetWidth:', effectiveTarget.width);
    console.log('[optimize-image] effectiveTargetHeight:', effectiveTarget.height);
    if (pixelPortraitSpec) {
      console.log('[optimize-image] styleBucket:', pixelPortraitSpec.styleLevel);
      console.log('[optimize-image] nColors:', pixelPortraitSpec.nColors);
      console.log('[optimize-image] maxDarkRatio:', pixelPortraitSpec.maxDarkRatio);
    }

    // ============================================
    // 2. 调用 Seedream API
    // ============================================

    console.log('[optimize-image] 使用 Seedream...');

    // pixelPortrait 模式：自动注入默认风格参考图
    let effectiveReferenceImageUrl = referenceImageUrl;
    
    if (aiMode === 'pixelPortrait' && !effectiveReferenceImageUrl) {
      // 自动使用默认风格参考图
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}${DEFAULT_REFERENCE_IMAGE_PATH}`;
      console.log('[optimize-image] pixelPortrait 自动注入默认风格参考图:', effectiveReferenceImageUrl);
    } 
    // 🚨 新增：为像素全身模式强制注入神级参考图！
    else if (aiMode === 'pixelFullBody' && !effectiveReferenceImageUrl) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}/reference/pixel-fullbody-style.png`;
      console.log('[optimize-image] pixelFullBody 自动注入全身风格参考图:', effectiveReferenceImageUrl);
    }
    // 🚨 新增：为 Q 版像素大头模式强制注入大头娃娃画风模板！
    else if (aiMode === 'pixelDoll' && !effectiveReferenceImageUrl) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}/reference/pixel-doll-style.png`;
      console.log('[optimize-image] pixelDoll 自动注入大头风格参考图:', effectiveReferenceImageUrl);
    }
    // 🚨 新增：为动漫像素图模式强制注入画风模板！
    else if (aiMode === 'cartoon' && !effectiveReferenceImageUrl) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}/reference/pixel-cartoon-style.png`;
      console.log('[optimize-image] cartoon 自动注入卡通风格参考图:', effectiveReferenceImageUrl);
    }
    // 🚨 新增：为萌宠模式注入画风模板！
    else if (aiMode === 'cutePet' && !effectiveReferenceImageUrl) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}/reference/pixel-cutepet-style.png`;
      console.log('[optimize-image] cutePet 自动注入萌宠风格参考图:', effectiveReferenceImageUrl);
    }
    // 🚨 新增：为汽车专用风注入画风模板！
    else if (aiMode === 'carStyle' && !effectiveReferenceImageUrl) {
      const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
      effectiveReferenceImageUrl = `${baseUrl}/reference/pixel-car-style.png`;
      console.log('[optimize-image] carStyle 自动注入汽车风格参考图:', effectiveReferenceImageUrl);
    }

    // 生成 prompt
    const hasReferenceImage = !!effectiveReferenceImageUrl;
    
    console.log('[optimize-image] 生成 prompt，targetSize:', effectiveTargetSize, 'hasReferenceImage:', hasReferenceImage);
    const prompt = buildPrompt(aiMode, effectiveTargetSize, hasReferenceImage);
    console.log('[optimize-image] Prompt 长度:', prompt.length);
    console.log('[optimize-image] Prompt 前 300 字:', prompt.substring(0, 300));

    // 🛡️ 6大风格独立参数隔离配置表 (控制 AI 对原图的还原度)
    const STYLE_WEIGHT_CONFIG: Record<string, number> = {
      pixelPortrait: 0.45, // 精确保留现有效果，不改变
      pixelFullBody: 0.55, // 像素全身：降至0.55，释放空间给像素风格参考图
      pixelDoll: 0.50,     // Q版像素大头：降至0.50，释放空间给大头参考图
      cartoon: 0.55,       // 动漫像素图：降低给风格图空间
      cutePet: 0.60,       // 可爱萌宠：降低融合
      carStyle: 0.65,      // 汽车专用风：适当降低
    };
    const currentImageWeight = STYLE_WEIGHT_CONFIG[aiMode] || 0.5;
    console.log('[optimize-image] image_weight:', currentImageWeight, '(mode:', aiMode, ')');

    // 调用 Seedream API
    console.log('[optimize-image] 调用 Seedream API...');
    console.log('[optimize-image] referenceImageUrl:', effectiveReferenceImageUrl || '无');
    const seedreamResult = await callSeedreamAPI({
      aiMode,
      imageUrl,
      referenceImageUrl: effectiveReferenceImageUrl,
      prompt,
      targetSize: effectiveTargetSize,
      imageWeight: currentImageWeight
    });

    // 保存图片
    console.log('[optimize-image] 保存生成的图片...');
    const savedImage = await saveGeneratedImage(seedreamResult);
    const outputSize = getSizeForAiMode(aiMode, effectiveTargetSize);

    console.log('[optimize-image] 处理成功!');
    console.log('[optimize-image] Output URL:', savedImage.imageUrl);
    console.log('[optimize-image] Seedream Size:', outputSize);
    console.log('[optimize-image] Reference Image Used:', effectiveReferenceImageUrl || '无');

    return NextResponse.json({
      success: true,
      provider: 'seedream',
      mode: aiMode,
      inputImageUrl: imageUrl,
      outputImageUrl: savedImage.imageUrl,
      referenceImageUrl: effectiveReferenceImageUrl,
      debug: {
        aiMode,
        targetSize: effectiveTargetSize,
        targetWidth: effectiveTarget.width,
        targetHeight: effectiveTarget.height,
        styleBucket: pixelPortraitSpec?.styleLevel || null,
        nColors: pixelPortraitSpec?.nColors || null,
        maxDarkRatio: pixelPortraitSpec?.maxDarkRatio || null,
        requestTargetWidth: targetWidth,
        requestTargetHeight: targetHeight,
        outputSize,
        hasReferenceImage,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 300)
      }
    });

  } catch (error) {
    console.error('[optimize-image] 异常:', error);
    return NextResponse.json({
      success: false,
      provider: 'seedream',
      mode: 'pixelPortrait',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
