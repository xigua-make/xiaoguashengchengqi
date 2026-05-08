'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Image as ImageIcon, Wand2, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { useActivation } from '../../hooks/useActivation';
import { useAITimes } from '../../hooks/useAITimes';
import ActivationModal from '../../components/ActivationModal';
import AITimesActivationModal from '../../components/AITimesActivationModal';

// 格式化剩余时间
function formatRemainingTime(expiresAt: string | null, durationType: string | null): string {
  if (durationType === 'permanent') return '永久有效';
  if (!expiresAt) return '永久有效';
  
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs <= 0) return '已到期';
  
  if (durationType === '30s') {
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
    return `剩余 ${diffSeconds}秒`;
  }
  
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const diffHours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const diffMinutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  
  if (diffDays > 0) {
    return `剩余 ${diffDays}天${diffHours > 0 ? diffHours + '小时' : ''}`;
  } else if (diffHours > 0) {
    return `剩余 ${diffHours}小时${diffMinutes > 0 ? diffMinutes + '分钟' : ''}`;
  } else {
    return `剩余 ${diffMinutes}分钟`;
  }
}

export default function CreatePage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showAITimesModal, setShowAITimesModal] = useState(false);
  const [remainingTimeText, setRemainingTimeText] = useState('');
  const activation = useActivation();
  const aiTimes = useAITimes();

  // 实时更新剩余时间
  useEffect(() => {
    if (!activation.isActivated) {
      setRemainingTimeText('');
      return;
    }
    
    if (activation.durationType === 'permanent') {
      setRemainingTimeText('永久有效');
      return;
    }
    
    if (!activation.expiresAt) {
      setRemainingTimeText('永久有效');
      return;
    }

    const updateTime = () => {
      setRemainingTimeText(formatRemainingTime(activation.expiresAt, activation.durationType));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [activation.isActivated, activation.expiresAt, activation.durationType]);

  // 处理图片直接识别的点击
  const handleImageRecognition = async () => {
    if (isVerifying) return;
    
    setIsVerifying(true);
    
    // 显示一个提示
    const result = await activation.checkActivation();

    if (!result || activation.isExpired) {
      // 未激活或已过期，显示激活弹窗
      setShowActivationModal(true);
    } else {
      // 验证通过，跳转到工作台
      window.location.href = '/workstation';
      return;
    }
    
    setIsVerifying(false);
  };

  // 处理AI转像素图的点击
  const handleAIPixels = async () => {
    if (aiTimes.isVerifying) return;
    
    // 检查是否有剩余次数
    if (!aiTimes.isActivated || aiTimes.remainingTimes <= 0) {
      setShowAITimesModal(true);
      return;
    }
    
    // 有次数，直接跳转
    window.location.href = '/ai-pixels';
  };

  // AI次数激活成功后的回调
  const handleAITimesSuccess = () => {
    // 激活成功后跳转到AI转像素图页面
    window.location.href = '/ai-pixels';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 顶部导航 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">选择创作方式</h1>
          </div>
        </div>
      </header>

      {/* 验证状态提示 */}
      {isVerifying && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-blue-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>正在验证激活状态...</span>
        </motion.div>
      )}

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400 text-sm font-medium mb-4">
            <Wand2 className="w-4 h-4" />
            <span>选择您的创作方式</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">
            您想要怎样创作？
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            选择最适合您的拼豆创作方式
          </p>
        </motion.div>

        {/* 选择卡片 */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* 卡片1：AI 转像素图 */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div 
              onClick={handleAIPixels}
              className="group relative bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-purple-100 dark:border-purple-900 hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer overflow-hidden min-h-[280px]"
            >
              {/* 装饰背景 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200 to-blue-200 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
              
              {/* 右上角次数显示 */}
              {aiTimes.isLoading || aiTimes.isVerifying ? (
                <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>验证中...</span>
                </div>
              ) : aiTimes.isActivated && aiTimes.remainingTimes > 0 ? (
                <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>剩余 {aiTimes.remainingTimes} 豆</span>
                </div>
              ) : (
                <div className="absolute top-4 right-4 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-3 py-1.5 rounded-full text-xs font-medium">
                  未激活
                </div>
              )}
              
              <div className="relative">
                {/* 图标 */}
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                
                {/* 标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    AI 转像素图
                  </h3>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-xs font-medium rounded-full">
                    AI 智能
                  </span>
                </div>
                
                {/* 描述 */}
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                  真人照片秒变可爱动画像素风格，纯白背景适配拼豆制作。支持日漫、迪士尼、像素、Q版等多种风格。
                </p>
                
                {/* 特点标签 */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-xs rounded-full">
                    日漫风格
                  </span>
                  <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-xs rounded-full">
                    迪士尼风
                  </span>
                  <span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-xs rounded-full">
                    Q版可爱
                  </span>
                </div>
                
                {/* 箭头指示 */}
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 卡片2：图片直接识别 */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div
              onClick={handleImageRecognition}
              className="group relative bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer overflow-hidden min-h-[280px]"
            >
              {/* 加载状态 */}
              {isVerifying && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 z-10 flex items-center justify-center rounded-3xl">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              )}
              
              {/* 装饰背景 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-200 to-cyan-200 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity" />
              
              {/* 激活状态徽章 - 卡片右上角 */}
              <div className="absolute top-4 right-4 z-10">
                {activation.isActivated && !activation.isExpired ? (
                  <div className="px-2.5 py-1 bg-green-500/90 backdrop-blur-sm rounded-full flex items-center gap-1 shadow-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span className="text-white text-xs font-medium">{remainingTimeText}</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 bg-gray-500/90 backdrop-blur-sm rounded-full flex items-center gap-1 shadow-lg">
                    <span className="text-white text-xs font-medium">未激活</span>
                  </div>
                )}
              </div>
              
              <div className="relative">
                {/* 图标 */}
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-8 h-8 text-white" />
                </div>
                
                {/* 标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    图片直接识别
                  </h3>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 text-xs font-medium rounded-full">
                    快速精准
                  </span>
                </div>
                
                {/* 描述 */}
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                  上传图片直接识别转换为拼豆图纸，可手动精修调整。支持多种色号系统，适合精细化创作。
                </p>
                
                {/* 特点标签 */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs rounded-full">
                    一键生成
                  </span>
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs rounded-full">
                    手动精修
                  </span>
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs rounded-full">
                    多色号支持
                  </span>
                </div>
                
                {/* 箭头指示 */}
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 底部提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-10"
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            不确定选哪个？AI转像素图适合想要可爱风格，真人照片创作的用户
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            图片直接识别适合已有图片素材，想要精准控制的用户
          </p>
        </motion.div>
      </main>

      {/* 激活弹窗 */}
      <ActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onActivate={activation.activate}
      />

      {/* AI次数激活弹窗 */}
      <AITimesActivationModal
        isOpen={showAITimesModal}
        onClose={() => setShowAITimesModal(false)}
        aiTimes={aiTimes}
        onSuccess={handleAITimesSuccess}
      />
    </div>
  );
}
