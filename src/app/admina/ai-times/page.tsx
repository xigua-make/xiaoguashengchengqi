'use client';

import React, { useState, useCallback } from 'react';

interface AITimesCode {
  id: number;
  code: string;
  ai_times: number;
  used_times: number;
  is_active: boolean;
  created_at: string;
  batch_id: number | null;
}

interface Batch {
  id: number;
  ai_times: number;
  count: number;
  created_at: string;
}

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function AITimesPage() {
  // 每次进入页面都是未登录状态，不保存登录状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [codes, setCodes] = useState<AITimesCode[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'records'>('list');
  
  // 生成激活码表单
  const [aiTimes, setAiTimes] = useState('10');
  const [generateCount, setGenerateCount] = useState('1');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTimes, setFilterTimes] = useState('all');
  
  // 编辑模式
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAiTimes, setEditAiTimes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  
  // 批量选择
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Toast 通知
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // 登录
  const handleLogin = async (pwd?: string) => {
    const loginPwd = pwd || password;
    if (!loginPwd.trim()) {
      setLoginError('请输入密码');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-times', {
        headers: { Authorization: `Bearer ${loginPwd}` },
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setLoginError('');
        setCodes(data.data || []);
        loadBatches(loginPwd);
      } else {
        setLoginError(data.error || '密码错误');
      }
    } catch {
      setLoginError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 获取生成记录
  const loadBatches = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/ai-times?action=batches', {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const data = await res.json();
      if (data.success) {
        setBatches(data.data || []);
      }
    } catch {
      console.error('获取生成记录失败');
    }
  };

  // 加载数据
  const loadData = async (pwd: string) => {
    try {
      const res = await fetch('/api/admin/ai-times', {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const data = await res.json();
      if (data.success) {
        setCodes(data.data);
      }
    } catch {
      console.error('获取AI次数失败');
    }

    try {
      const res = await fetch('/api/admin/ai-times?action=batches', {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const data = await res.json();
      if (data.success) {
        setBatches(data.data);
      }
    } catch {
      console.error('获取生成记录失败');
    }
  };

  // 生成AI次数激活码
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          aiTimes: parseInt(aiTimes),
          count: parseInt(generateCount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCodes(data.data);
        showToast(`成功生成 ${data.data.length} 个AI次数激活码`, 'success');
        loadData(password);
      } else {
        showToast(data.error || '生成失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 保存编辑
  const handleSaveEdit = async (id: number) => {
    try {
      const res = await fetch('/api/admin/ai-times', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ 
          id, 
          isActive: editIsActive,
          aiTimes: parseInt(editAiTimes)
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('保存成功', 'success');
        setEditingId(null);
        loadData(password);
      } else {
        showToast(data.error || '保存失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    }
  };

  // 开始编辑
  const startEdit = (code: AITimesCode) => {
    setEditingId(code.id);
    setEditAiTimes(code.ai_times.toString());
    setEditIsActive(code.is_active);
  };

  // 切换启用/禁用
  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/ai-times', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ 
          id, 
          isActive: !currentStatus
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(!currentStatus ? '已启用' : '已禁用', 'success');
        loadData(password);
      } else {
        showToast(data.error || '操作失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    }
  };

  // 删除激活码
  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`确定要删除AI次数激活码 ${code} 吗？此操作不可恢复。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/ai-times?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('删除成功', 'success');
        loadData(password);
        setSelectedIds(prev => prev.filter(i => i !== id));
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch {
      showToast('网络错误', 'error');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      showToast('请先选择要删除的激活码', 'error');
      return;
    }
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个激活码吗？此操作不可恢复。`)) {
      return;
    }
    
    setLoading(true);
    try {
      const results = await Promise.all(
        selectedIds.map(id => 
          fetch(`/api/admin/ai-times?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${password}` },
          })
        )
      );
      
      const successCount = results.filter(r => r.ok).length;
      if (successCount === selectedIds.length) {
        showToast(`成功删除 ${successCount} 个激活码`, 'success');
      } else {
        showToast(`成功删除 ${successCount} 个，失败 ${selectedIds.length - successCount} 个`, 'error');
      }
      
      setSelectedIds([]);
      loadData(password);
    } catch {
      showToast('批量删除失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除已用尽的激活码
  const handleDeleteUsed = async () => {
    const usedCodes = codes.filter(c => c.used_times >= c.ai_times);
    if (usedCodes.length === 0) {
      showToast('没有已用尽的激活码', 'error');
      return;
    }
    if (!confirm(`确定要删除所有 ${usedCodes.length} 个已用尽的激活码吗？此操作不可恢复。`)) {
      return;
    }
    
    setLoading(true);
    try {
      const results = await Promise.all(
        usedCodes.map(code => 
          fetch(`/api/admin/ai-times?id=${code.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${password}` },
          })
        )
      );
      
      const successCount = results.filter(r => r.ok).length;
      showToast(`成功删除 ${successCount} 个已用尽的激活码`, 'success');
      loadData(password);
    } catch {
      showToast('删除失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除所有已禁用的激活码
  const handleDeleteInactive = async () => {
    const inactiveCodes = codes.filter(c => !c.is_active);
    if (inactiveCodes.length === 0) {
      showToast('没有已禁用的激活码', 'error');
      return;
    }
    if (!confirm(`确定要删除所有 ${inactiveCodes.length} 个已禁用的激活码吗？此操作不可恢复。`)) {
      return;
    }
    
    setLoading(true);
    try {
      const results = await Promise.all(
        inactiveCodes.map(code => 
          fetch(`/api/admin/ai-times?id=${code.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${password}` },
          })
        )
      );
      
      const successCount = results.filter(r => r.ok).length;
      showToast(`成功删除 ${successCount} 个已禁用的激活码`, 'success');
      loadData(password);
    } catch {
      showToast('删除失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  };

  // 导出批次为CSV
  const exportBatchToCSV = async (batchId: number) => {
    try {
      const res = await fetch(`/api/admin/ai-times?action=batch_codes&batchId=${batchId}`, {
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (data.success) {
        const codes = JSON.parse(data.data);
        const csvContent = codes.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai_times_batch_${batchId}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('导出成功', 'success');
      } else {
        showToast('导出失败', 'error');
      }
    } catch {
      showToast('导出失败', 'error');
    }
  };

  // 退出登录 - 重置登录状态
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setCodes([]);
    setBatches([]);
  };

  // 切换单个选中状态
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // 切换全选
  const toggleSelectAll = () => {
    const allIds = filteredCodes.map(c => c.id);
    const allSelected = allIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : allIds);
  };

  // 统计数据
  const stats = {
    total: codes.length,
    active: codes.filter(c => c.is_active && c.used_times < c.ai_times).length,
    inactive: codes.filter(c => !c.is_active).length,
    usedUp: codes.filter(c => c.used_times >= c.ai_times).length,
    totalTimes: codes.reduce((sum, c) => sum + c.ai_times, 0),
    usedTimes: codes.reduce((sum, c) => sum + c.used_times, 0),
  };

  // 筛选后的激活码列表
  const filteredCodes = codes.filter(code => {
    const matchSearch = code.code.includes(searchQuery);
    const matchStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && code.is_active && code.used_times < code.ai_times) ||
      (filterStatus === 'inactive' && !code.is_active) ||
      (filterStatus === 'usedup' && code.used_times >= code.ai_times);
    const matchTimes = filterTimes === 'all' || code.ai_times === parseInt(filterTimes);
    return matchSearch && matchStatus && matchTimes;
  });

  // 获取所有不同的AI次数值（用于筛选下拉框）
  const uniqueAiTimes = [...new Set(codes.map(c => c.ai_times))].sort((a, b) => a - b);

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 登录页面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            AI次数管理后台
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                管理员密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="off"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-gray-900"
                placeholder="请输入管理员密码"
              />
            </div>
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </div>
        </div>
      </div>
    );
  }



  // 管理页面
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toast通知 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white transform transition-all ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* 生成弹窗 */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">生成AI次数激活码</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  AI次数
                </label>
                <input
                  type="number"
                  value={aiTimes}
                  onChange={(e) => setAiTimes(e.target.value)}
                  min="1"
                  max="999"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="输入AI次数"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-2">
                  生成数量
                </label>
                <input
                  type="number"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="输入数量"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setGeneratedCodes([]);
                }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {loading ? '生成中...' : '生成'}
              </button>
            </div>

            {generatedCodes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  已生成的激活码 ({generatedCodes.length}个，8位数字)
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {generatedCodes.map((code, index) => (
                    <div
                      key={index}
                      onClick={() => copyToClipboard(code)}
                      className="font-mono text-indigo-600 bg-white px-2 py-1 rounded cursor-pointer hover:bg-indigo-50 transition-colors text-sm mb-1 inline-block mr-2"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">点击激活码可复制</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 移动端顶部导航栏 */}
      <div className="mobile-header fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-4 z-50 md:hidden flex">
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
        >
          退出登录
        </button>
        <span className="text-lg font-bold text-amber-600">AI次数管理</span>
        <div className="w-16"></div>
      </div>
      
      {/* 主内容区 */}
      <main className="overflow-y-auto p-4 md:p-8 pt-16 md:pt-8">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              退出登录
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">
              {activeTab === 'list' ? 'AI次数激活码管理' : '生成记录'}
            </h1>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={() => {
                setGeneratedCodes([]);
                setShowGenerateModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20 font-medium text-sm md:text-base"
            >
              <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>生成AI次数激活码</span>
            </button>
          )}
        </header>

        {/* Tab切换 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'list'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            激活码列表
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'records'
                ? 'bg-indigo-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            生成记录
          </button>
        </div>

        {/* 激活码列表Tab */}
        {activeTab === 'list' && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5">
                <div className="w-10 md:w-12 h-10 md:h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 md:w-6 h-5 md:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm text-gray-500 mb-1">总激活码</h3>
                  <p className="text-xl md:text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5">
                <div className="w-10 md:w-12 h-10 md:h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 md:w-6 h-5 md:h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm text-gray-500 mb-1">可用</h3>
                  <p className="text-xl md:text-2xl font-bold text-gray-800">{stats.active}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5">
                <div className="w-10 md:w-12 h-10 md:h-12 bg-gray-200 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 md:w-6 h-5 md:h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm text-gray-500 mb-1">已用尽</h3>
                  <p className="text-xl md:text-2xl font-bold text-gray-800">{stats.usedUp}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 flex items-center gap-3 md:gap-5">
                <div className="w-10 md:w-12 h-10 md:h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 md:w-6 h-5 md:h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs md:text-sm text-gray-500 mb-1">剩余豆数</h3>
                  <p className="text-xl md:text-2xl font-bold text-gray-800">{stats.totalTimes - stats.usedTimes}</p>
                </div>
              </div>
            </div>

            {/* 批量操作按钮 */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-2 md:gap-3">
              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.length === 0 || loading}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>删除选中 ({selectedIds.length})</span>
              </button>
              
              <button
                onClick={handleDeleteInactive}
                disabled={stats.inactive === 0 || loading}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>删除已禁用 ({stats.inactive})</span>
              </button>

              <button
                onClick={handleDeleteUsed}
                disabled={loading}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>删除已用尽 ({stats.usedUp})</span>
              </button>

              <div className="flex-1"></div>
              
              <span className="text-xs md:text-sm text-gray-500 flex items-center">
                已选择 {selectedIds.length} / {filteredCodes.length}
              </span>
            </div>

            {/* 激活码列表 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center justify-between">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索激活码..."
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-full text-sm"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 md:px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm w-full md:w-auto"
                  >
                    <option value="all">全部状态</option>
                    <option value="active">可用</option>
                    <option value="inactive">已禁用</option>
                    <option value="usedup">已用尽</option>
                  </select>
                  <select
                    value={filterTimes}
                    onChange={(e) => setFilterTimes(e.target.value)}
                    className="px-3 md:px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm w-full md:w-auto"
                  >
                    <option value="all">全部次数</option>
                    {uniqueAiTimes.map(times => (
                      <option key={times} value={times}>{times}次</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-gray-500">共 {filteredCodes.length} 条记录</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="w-10 px-3 md:px-6 py-3 md:py-4 text-left">
                        <input
                          type="checkbox"
                          checked={filteredCodes.length > 0 && filteredCodes.every(code => selectedIds.includes(code.id))}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 accent-indigo-500"
                        />
                      </th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600">激活码</th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600">AI次数</th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600">已用次数</th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600 hidden md:table-cell">状态</th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600 hidden md:table-cell">创建时间</th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 md:px-6 py-8 md:py-12 text-center text-gray-500 text-sm">
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      filteredCodes.map((code) => (
                        <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                          <td className="w-10 px-3 md:px-6 py-3 md:py-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(code.id)}
                              onChange={() => toggleSelect(code.id)}
                              className="w-4 h-4 accent-indigo-500"
                            />
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <span 
                              onClick={() => copyToClipboard(code.code)}
                              className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100 transition-colors text-sm"
                            >
                              {code.code}
                            </span>
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            {editingId === code.id ? (
                              <input
                                type="number"
                                value={editAiTimes}
                                onChange={(e) => setEditAiTimes(e.target.value)}
                                className="w-16 md:w-20 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                                min="1"
                              />
                            ) : (
                              <span className="text-gray-700">{code.ai_times}</span>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <span className={`font-medium ${
                              code.used_times >= code.ai_times ? 'text-red-500' : 'text-green-600'
                            }`}>
                              {code.used_times}
                            </span>
                            <span className="text-gray-400"> / {code.ai_times}</span>
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              code.is_active 
                                ? (code.used_times >= code.ai_times ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700')
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {code.is_active 
                                ? (code.used_times >= code.ai_times ? '已用尽' : '可用')
                                : '已禁用'}
                            </span>
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-500 hidden md:table-cell">
                            {formatDate(code.created_at)}
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <div className="flex items-center gap-2">
                              {editingId === code.id ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(code.id)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="保存"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                    title="取消"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleToggleActive(code.id, code.is_active)}
                                    className={`p-1.5 rounded transition-colors ${
                                      code.is_active 
                                        ? 'text-orange-500 hover:bg-orange-50' 
                                        : 'text-green-500 hover:bg-green-50'
                                    }`}
                                    title={code.is_active ? '禁用' : '启用'}
                                  >
                                    {code.is_active ? (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => startEdit(code)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                    title="编辑"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(code.id, code.code)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="删除"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 生成记录Tab */}
        {activeTab === 'records' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 md:p-6 border-b border-gray-100">
              <h2 className="text-lg md:text-xl font-semibold text-gray-800">激活码生成记录</h2>
              <p className="text-sm text-gray-500 mt-1">每次批量生成激活码都会记录在这里，可以导出为CSV格式</p>
            </div>
            
            {batches.length === 0 ? (
              <div className="p-8 md:p-12 text-center text-gray-500">
                暂无生成记录
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {batches.map((batch) => (
                  <div key={batch.id} className="p-4 md:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 md:gap-3">
                            <span className="font-medium text-gray-800 text-sm md:text-base">批次 #{batch.id}</span>
                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs md:text-sm font-medium">
                              {batch.ai_times}豆
                            </span>
                          </div>
                          <div className="text-xs md:text-sm text-gray-500 mt-1">
                            生成 <span className="font-semibold text-gray-700">{batch.count}</span> 个激活码 · 
                            {formatDate(batch.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3">
                        <button
                          onClick={() => {
                            const codes = JSON.parse(batch.codes);
                            copyToClipboard(codes.join('\n'));
                          }}
                          className="px-3 md:px-4 py-2 text-xs md:text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          复制全部
                        </button>
                        <button
                          onClick={() => exportBatchToCSV(batch.id)}
                          className="px-3 md:px-4 py-2 text-xs md:text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                        >
                          导出CSV
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 md:mt-4 flex flex-wrap gap-1 md:gap-2">
                      {JSON.parse(batch.codes).slice(0, 10).map((code: string) => (
                        <span
                          key={code}
                          onClick={() => copyToClipboard(code)}
                          className="px-2 md:px-3 py-1 bg-gray-100 rounded text-xs md:text-sm font-mono cursor-pointer hover:bg-gray-200 transition-colors"
                        >
                          {code}
                        </span>
                      ))}
                      {JSON.parse(batch.codes).length > 10 && (
                        <span className="px-2 md:px-3 py-1 text-gray-500 text-xs md:text-sm">
                          ...还有 {JSON.parse(batch.codes).length - 10} 个
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
