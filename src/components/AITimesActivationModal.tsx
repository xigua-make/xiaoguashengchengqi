'use client';

import React, { useState } from 'react';

const AITIMES_STORAGE_KEY = 'xiaogua_ai_times';

interface AITimesActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiTimes: {
    isActivated: boolean;
    remainingTimes: number;
    isLoading: boolean;
    isVerifying: boolean;
    verifyWithServer: () => Promise<{ success: boolean; remainingTimes: number; error?: string }>;
  };
  onSuccess?: () => void;
}

export default function AITimesActivationModal({ isOpen, onClose, aiTimes, onSuccess }: AITimesActivationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    remainingTimes: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('请输入激活码');
      return;
    }

    if (code.length !== 8) {
      setError('请输入正确的8位激活码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai-times/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      
      const data = await res.json();

      if (data.success) {
        // 激活成功 - 保存到本地存储
        localStorage.setItem(AITIMES_STORAGE_KEY, JSON.stringify({
          codeId: data.codeId,
          remainingTimes: data.remainingTimes,
          verifiedAt: new Date().toISOString(),
        }));
        
        // 激活成功
        setSuccess(true);
        setSuccessInfo({
          remainingTimes: data.remainingTimes,
        });
        setCode('');
        
        // 延迟关闭并跳转
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setSuccessInfo(null);
          // 回调成功
          if (onSuccess) {
            onSuccess();
          }
        }, 1500);
      } else {
        setError(data.error || '激活失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setSuccess(false);
    setSuccessInfo(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">AI次数激活</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 激活成功状态 */}
        {success && successInfo ? (
          <div className="px-5 py-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-gray-800 mb-1">激活成功</h4>
              <p className="text-sm text-gray-500">您的AI次数已成功激活</p>
            </div>

            {/* 次数信息 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">剩余次数</span>
                <span className="text-lg font-bold text-amber-500">
                  {successInfo.remainingTimes} 豆
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                setSuccess(false);
                setSuccessInfo(null);
                if (onSuccess) {
                  onSuccess();
                }
              }}
              className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              开始使用
            </button>
          </div>
        ) : (
          <>
            {/* 说明文字 */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-gray-500">
                输入AI次数激活码以解锁AI转像素图功能
              </p>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="px-5 pb-2">
                <p className="text-xs text-white bg-red-500 px-3 py-2 rounded-lg">
                  {error}
                </p>
              </div>
            )}

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  8位激活码
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setError('');
                  }}
                  placeholder="请输入8位数字激活码"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 font-mono text-center tracking-widest"
                  maxLength={8}
                />
              </div>

              {/* 按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '激活中...' : '激活'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
