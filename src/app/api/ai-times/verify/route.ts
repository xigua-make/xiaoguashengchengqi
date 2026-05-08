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

// 获取请求头中的设备ID和激活码ID
function getHeadersDeviceInfo(request: NextRequest): { deviceId: string; codeId: number | null } {
  const deviceId = request.headers.get('X-Device-ID') || generateDeviceId();
  const codeIdStr = request.headers.get('X-Code-ID');
  const codeId = codeIdStr ? parseInt(codeIdStr, 10) : null;
  return { deviceId, codeId: isNaN(codeId as number) ? null : codeId };
}

// 验证AI次数
export async function GET(request: NextRequest) {
  try {
    const { deviceId, codeId } = getHeadersDeviceInfo(request);

    const client = getSupabaseClient();

    // 如果有激活码ID，直接查询该激活码的剩余次数
    if (codeId) {
      const { data: aiCode, error } = await client
        .from('ai_times')
        .select('*')
        .eq('id', codeId)
        .single();

      if (error || !aiCode) {
        return NextResponse.json({
          success: false,
          remainingTimes: 0,
          codeId: null,
          error: '激活码不存在',
        });
      }

      // 检查是否已禁用
      if (!aiCode.is_active) {
        return NextResponse.json({
          success: false,
          remainingTimes: 0,
          codeId: null,
          error: '该激活码已被禁用',
        });
      }

      const remainingTimes = Math.max(0, aiCode.ai_times - aiCode.used_times);

      return NextResponse.json({
        success: remainingTimes > 0,
        remainingTimes,
        codeId: aiCode.id,
        aiTimes: aiCode.ai_times,
        usedTimes: aiCode.used_times,
        deviceId,
      });
    }

    // 如果没有激活码ID，返回未激活状态
    return NextResponse.json({
      success: false,
      remainingTimes: 0,
      codeId: null,
      error: '暂无激活的AI次数',
    });
  } catch (error) {
    console.error('AI次数验证失败:', error);
    return NextResponse.json({
      success: false,
      remainingTimes: 0,
      error: '验证失败',
    });
  }
}
