import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const AITIMES_DEVICE_KEY = 'xiaogua_ai_device_id';

// 生成设备ID
function generateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(AITIMES_DEVICE_KEY);
  if (id) return id;

  id = 'ai_device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  localStorage.setItem(AITIMES_DEVICE_KEY, id);
  return id;
}

// 激活AI次数
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 8) {
      return NextResponse.json({
        success: false,
        error: '请输入正确的8位激活码',
      });
    }

    const deviceId = generateDeviceId();
    const client = getSupabaseClient();

    // 查找激活码
    const { data: aiCode, error: findError } = await client
      .from('ai_times')
      .select('*')
      .eq('code', code)
      .single();

    if (findError || !aiCode) {
      return NextResponse.json({
        success: false,
        error: '激活码不存在',
      });
    }

    // 检查是否已禁用
    if (!aiCode.is_active) {
      return NextResponse.json({
        success: false,
        error: '该激活码已被禁用',
      });
    }

    // 检查是否已用尽
    if (aiCode.used_times >= aiCode.ai_times) {
      return NextResponse.json({
        success: false,
        error: '该激活码次数已用尽',
      });
    }

    // 返回成功信息
    const remainingTimes = aiCode.ai_times - aiCode.used_times;

    return NextResponse.json({
      success: true,
      aiTimes: aiCode.ai_times,
      remainingTimes,
      codeId: aiCode.id,
      deviceId,
    });
  } catch (error) {
    console.error('AI次数激活失败:', error);
    return NextResponse.json({
      success: false,
      error: '激活失败，请重试',
    });
  }
}
