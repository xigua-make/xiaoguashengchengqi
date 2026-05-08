import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员密码
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'liujin8848328';

// 验证管理员权限
function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === ADMIN_PASSWORD;
}

// 生成8位数字激活码
function generateCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// 获取AI次数列表
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    const client = getSupabaseClient();

    // 获取生成记录
    if (action === 'batches') {
      const { data, error } = await client
        .from('ai_times_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('查询批次记录失败:', error);
        return NextResponse.json(
          { success: false, error: '查询失败' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data || [],
      });
    }

    // 获取单个批次的激活码（用于导出）
    if (action === 'batch_codes') {
      const batchId = searchParams.get('batchId');
      if (!batchId) {
        return NextResponse.json(
          { success: false, error: '缺少批次ID' },
          { status: 400 }
        );
      }

      const { data, error } = await client
        .from('ai_times_batches')
        .select('codes')
        .eq('id', parseInt(batchId))
        .single();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: '批次不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data.codes,
      });
    }

    // 获取AI次数列表（默认）
    const { data, error } = await client
      .from('ai_times')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('查询AI次数失败:', error);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('AI次数API错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 生成AI次数激活码
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { aiTimes = 10, count = 1 } = body;

    const client = getSupabaseClient();
    const codes: string[] = [];
    const now = new Date();

    // 生成指定数量的8位激活码
    for (let i = 0; i < count; i++) {
      let code: string;
      let isUnique = false;
      
      // 确保激活码唯一
      while (!isUnique) {
        code = generateCode();
        const { data } = await client
          .from('ai_times')
          .select('id')
          .eq('code', code)
          .single();
        
        if (!data) {
          isUnique = true;
        }
      }
      
      codes.push(code!);
    }

    // 批量插入激活码
    const insertData = codes.map(code => ({
      code,
      ai_times: aiTimes,
      used_times: 0,
      is_active: true,
      created_at: now.toISOString(),
    }));

    const { error: insertError } = await client
      .from('ai_times')
      .insert(insertData);

    if (insertError) {
      console.error('插入AI次数失败:', insertError);
      return NextResponse.json(
        { success: false, error: '生成失败' },
        { status: 500 }
      );
    }

    // 保存批次记录
    const { error: batchError } = await client
      .from('ai_times_batches')
      .insert({
        ai_times: aiTimes,
        count: codes.length,
        codes: JSON.stringify(codes),
        created_at: now.toISOString(),
      });

    if (batchError) {
      console.error('保存批次记录失败:', batchError);
    }

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error('生成AI次数失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 更新AI次数激活码
export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, isActive, aiTimes } = body;

    const client = getSupabaseClient();
    const updateData: Record<string, unknown> = {};

    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
    }
    if (typeof aiTimes === 'number') {
      updateData.ai_times = aiTimes;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 }
      );
    }

    const { error } = await client
      .from('ai_times')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('更新AI次数失败:', error);
      return NextResponse.json(
        { success: false, error: '更新失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('更新AI次数失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除AI次数激活码
export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('ai_times')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('删除AI次数失败:', error);
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('删除AI次数失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
