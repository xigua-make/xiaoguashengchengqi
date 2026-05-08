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

// 获取请求头中的codeId
function getCodeIdFromHeaders(request: NextRequest): number | null {
  const codeIdStr = request.headers.get('X-Code-ID');
  if (!codeIdStr) return null;
  const codeId = parseInt(codeIdStr, 10);
  return isNaN(codeId) ? null : codeId;
}

// 使用一次AI次数
export async function POST(request: NextRequest) {
  try {
    const codeId = getCodeIdFromHeaders(request);
    const deviceId = generateDeviceId();
    const client = getSupabaseClient();

    // 如果有 codeId，直接使用指定的激活码
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

      // 检查是否已用尽
      if (aiCode.used_times >= aiCode.ai_times) {
        return NextResponse.json({
          success: false,
          remainingTimes: 0,
          codeId: null,
          error: '该激活码次数已用尽，请激活新的激活码',
        });
      }

      // 扣减次数
      const newUsedTimes = aiCode.used_times + 1;
      const { error: updateError } = await client
        .from('ai_times')
        .update({ used_times: newUsedTimes })
        .eq('id', codeId);

      if (updateError) {
        console.error('扣减AI次数失败:', updateError);
        return NextResponse.json({
          success: false,
          error: '扣减失败',
        });
      }

      const remainingTimes = Math.max(0, aiCode.ai_times - newUsedTimes);

      return NextResponse.json({
        success: true,
        remainingTimes,
        codeId: aiCode.id,
        deviceId,
      });
    }

    // 如果没有 codeId，返回失败
    return NextResponse.json({
      success: false,
      remainingTimes: 0,
      codeId: null,
      error: '请先激活AI次数',
    });
  } catch (error) {
    console.error('使用AI次数失败:', error);
    return NextResponse.json({
      success: false,
      error: '操作失败',
    });
  }
}
