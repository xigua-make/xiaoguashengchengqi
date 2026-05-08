// 下载网格的选项类型定义
export type StatsBlockSize = 'large' | 'small';

export type GridDownloadOptions = {
  showGrid: boolean;
  gridInterval: number;
  showCoordinates: boolean;
  showCellNumbers: boolean;
  gridLineColor: string;
  includeStats: boolean;
  exportCsv: boolean; // 新增：是否同时导出CSV hex数据
  authorName: string; // 作者署名
  enableWatermark: boolean; // 是否启用水印
  watermarkOptions: {
    commercial: boolean; // 禁止商用
    repost: boolean; // 禁止二传
    reprint: boolean; // 禁止转载
    modify: boolean; // 禁止二改
  };
  statsBlockSize: StatsBlockSize; // 色块大小：大色块或小色块
};
