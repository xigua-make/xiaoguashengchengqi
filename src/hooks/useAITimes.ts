import { useState, useEffect, useCallback } from 'react';

const AITIMES_STORAGE_KEY = 'xiaogua_ai_times';

export interface AITimesState {
  remainingTimes: number;
  isActivated: boolean;
  isLoading: boolean;
  isVerifying: boolean;
  error: string | null;
}

export interface AITimesResult {
  remainingTimes: number;
  success: boolean;
  error?: string;
}

// 检查本地AI次数状态
function getLocalAITimes(): { codeId: number | null; remainingTimes: number } {
  if (typeof window === 'undefined') return { codeId: null, remainingTimes: 0 };
  
  const stored = localStorage.getItem(AITIMES_STORAGE_KEY);
  if (!stored) return { codeId: null, remainingTimes: 0 };

  try {
    const data = JSON.parse(stored);
    return { 
      codeId: data.codeId || null, 
      remainingTimes: data.remainingTimes || 0,
    };
  } catch {
    return { codeId: null, remainingTimes: 0 };
  }
}

export function useAITimes() {
  // 使用确定性初始状态，避免 Hydration 不匹配
  const [state, setState] = useState<AITimesState>({
    remainingTimes: 0,
    isActivated: false,
    isLoading: true,
    isVerifying: true,
    error: null,
  });
  
  // 保存当前的 codeId
  const [codeId, setCodeId] = useState<number | null>(null);
  
  // 标记是否已挂载（仅客户端）
  const [mounted, setMounted] = useState(false);

  // 确保只在客户端执行
  useEffect(() => {
    setMounted(true);
  }, []);

  // 从服务器验证AI次数状态
  const verifyWithServer = useCallback(async (): Promise<AITimesResult> => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // 获取本地存储的 codeId
      const localData = getLocalAITimes();
      const headers: Record<string, string> = {};
      if (localData.codeId) {
        headers['X-Code-ID'] = localData.codeId.toString();
      }
      
      const res = await fetch(`/api/ai-times/verify`, {
        cache: 'no-store',
        signal: controller.signal,
        headers,
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();

      // 必须完全依赖服务器返回
      if (data.success && data.remainingTimes > 0) {
        const remainingTimes = data.remainingTimes || 0;
        
        // 保存到本地
        localStorage.setItem(AITIMES_STORAGE_KEY, JSON.stringify({
          codeId: data.codeId,
          remainingTimes: remainingTimes,
          verifiedAt: new Date().toISOString(),
        }));

        // 更新 codeId 状态
        setCodeId(data.codeId);
        
        setState({
          remainingTimes,
          isActivated: true,
          isLoading: false,
          isVerifying: false,
          error: null,
        });
        
        return { remainingTimes, success: true };
      } else {
        // 服务器返回未激活或次数用尽
        localStorage.removeItem(AITIMES_STORAGE_KEY);
        setCodeId(null);
        
        setState({
          remainingTimes: 0,
          isActivated: false,
          isLoading: false,
          isVerifying: false,
          error: data.error || null,
        });
        
        return { remainingTimes: 0, success: false, error: data.error };
      }
    } catch (error) {
      const errorMsg = error instanceof Error && error.name === 'AbortError' ? '验证超时' : '网络错误';
      setState({
        remainingTimes: 0,
        isActivated: false,
        isLoading: false,
        isVerifying: false,
        error: errorMsg,
      });
      return { remainingTimes: 0, success: false, error: errorMsg };
    }
  }, []);

  // 初始化：必须从服务器验证，不依赖本地缓存
  useEffect(() => {
    // 先显示加载状态
    setState({
      remainingTimes: 0,
      isActivated: false,
      isLoading: true,
      isVerifying: true,
      error: null,
    });
    
    // 必须从服务器验证
    verifyWithServer();
  }, [verifyWithServer]);

  // 扣减AI次数
  const decrementTimes = useCallback(async (): Promise<boolean> => {
    try {
      // 获取本地存储的 codeId
      const localData = getLocalAITimes();
      const headers: Record<string, string> = {};
      if (localData.codeId) {
        headers['X-Code-ID'] = localData.codeId.toString();
      }
      
      const res = await fetch('/api/ai-times/use', {
        method: 'POST',
        cache: 'no-store',
        headers,
      });
      
      const data = await res.json();

      if (data.success) {
        const remainingTimes = data.remainingTimes || 0;
        
        // 更新本地
        localStorage.setItem(AITIMES_STORAGE_KEY, JSON.stringify({
          codeId: data.codeId,
          remainingTimes: remainingTimes,
          verifiedAt: new Date().toISOString(),
        }));

        setCodeId(data.codeId);
        
        setState(prev => ({
          ...prev,
          remainingTimes,
          isActivated: remainingTimes > 0,
        }));
        
        return true;
      } else {
        // 服务器返回失败
        if (data.error?.includes('用尽') || data.error?.includes('不存在') || data.error?.includes('禁用')) {
          localStorage.removeItem(AITIMES_STORAGE_KEY);
          setCodeId(null);
          setState({
            remainingTimes: 0,
            isActivated: false,
            isLoading: false,
            isVerifying: false,
            error: data.error,
          });
        }
        return false;
      }
    } catch {
      return false;
    }
  }, []);

  // 刷新状态
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, isVerifying: true }));
    await verifyWithServer();
  }, [verifyWithServer]);

  return {
    ...state,
    codeId,
    verifyWithServer,
    decrementTimes,
    refresh,
  };
}
