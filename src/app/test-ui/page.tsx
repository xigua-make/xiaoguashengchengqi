'use client';

import ModernPerlerUI from '@/components/ModernPerlerUI';

export default function TestUIPage() {
  const handleUpload = () => {
    console.log('Upload clicked');
    // TODO: 触发文件上传
  };

  const handleCreateBlank = () => {
    console.log('Create blank canvas clicked');
    // TODO: 创建空白画布
  };

  const handleApplyNumbers = () => {
    console.log('Apply numbers clicked');
    // TODO: 应用数字
  };

  const handleRemoveBackground = () => {
    console.log('Remove background clicked');
    // TODO: 一键去背景
  };

  const handleGenerate = () => {
    console.log('Generate clicked');
    // TODO: 生成图纸
  };

  const handleDownload = () => {
    console.log('Download clicked');
    // TODO: 下载图纸
  };

  const handleImport = () => {
    console.log('Import clicked');
    // TODO: 导入数据
  };

  const handleColorSelect = (color: { code: string; color: string }) => {
    console.log('Color selected:', color);
    // TODO: 选择颜色
  };

  const handleToolSelect = (tool: string) => {
    console.log('Tool selected:', tool);
    // TODO: 选择工具
  };

  const handleUndo = () => {
    console.log('Undo clicked');
    // TODO: 撤销
  };

  const handleRedo = () => {
    console.log('Redo clicked');
    // TODO: 重做
  };

  return (
    <ModernPerlerUI
      onUpload={handleUpload}
      onCreateBlank={handleCreateBlank}
      onApplyNumbers={handleApplyNumbers}
      onRemoveBackground={handleRemoveBackground}
      onGenerate={handleGenerate}
      onDownload={handleDownload}
      onImport={handleImport}
      onColorSelect={handleColorSelect}
      onToolSelect={handleToolSelect}
      onUndo={handleUndo}
      onRedo={handleRedo}
    />
  );
}
