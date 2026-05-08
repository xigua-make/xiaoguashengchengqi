import { transparentColorData } from './pixelEditingUtils';

// 定义像素化模式
export enum PixelationMode {
  Dominant = 'dominant', // 卡通模式（主色）
  Average = 'average',   // 真实模式（平均色）
}

// 定义色号系统类型
export type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

// --- 必要的类型定义 ---
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor {
  key: string;
  hex: string;
  rgb: RgbColor;
  mardKey: string; // MARD色号，用于显示
}

export interface MappedPixel {
  key: string;
  color: string;
  isExternal?: boolean;
}

// --- 辅助函数 ---

// 转换 Hex 到 RGB
export function hexToRgb(hex: string): RgbColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// --- 颜色距离函数（RGB 欧几里得距离，与 caidan1 仓库一致） ---
export function colorDistance(rgb1: RgbColor, rgb2: RgbColor): number {
  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// 查找最接近的颜色
export function findClosestPaletteColor(
  targetRgb: RgbColor,
  palette: PaletteColor[]
): PaletteColor {
  if (!palette || palette.length === 0) {
      console.error("findClosestPaletteColor: Palette is empty or invalid!");
      // 提供一个健壮的回退
      return { key: 'ERR', hex: '#000000', rgb: { r: 0, g: 0, b: 0 }, mardKey: 'ERR' };
  }

  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const paletteColor of palette) {
    const distance = colorDistance(targetRgb, paletteColor.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = paletteColor;
    }
    if (distance === 0) break; // 完全匹配，提前退出
  }
  return closestColor;
}


// --- 核心像素化计算逻辑 ---

/**
 * 计算图像指定区域的代表色（根据所选模式）
 * @param imageData 包含像素数据的 ImageData 对象
 * @param startX 区域起始 X 坐标
 * @param startY 区域起始 Y 坐标
 * @param width 区域宽度
 * @param height 区域高度
 * @param mode 计算模式 ('dominant' 或 'average')
 * @returns 代表色的 RGB 对象，或 null（如果区域无效或全透明）
 */
function calculateCellRepresentativeColor(
    imageData: ImageData,
    startX: number,
    startY: number,
    width: number,
    height: number,
    mode: PixelationMode
): RgbColor | null {
    const data = imageData.data;
    const imgWidth = imageData.width;
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;
    const colorCountsInCell: { [key: string]: number } = {};
    let dominantColorRgb: RgbColor | null = null;
    let maxCount = 0;

    const endX = startX + width;
    const endY = startY + height;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const index = (y * imgWidth + x) * 4;
            // 检查 alpha 通道，忽略完全透明的像素
            if (data[index + 3] < 128) continue;

            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            pixelCount++;

            if (mode === PixelationMode.Average) {
                rSum += r;
                gSum += g;
                bSum += b;
            } else { // Dominant mode
                const colorKey = `${r},${g},${b}`;
                colorCountsInCell[colorKey] = (colorCountsInCell[colorKey] || 0) + 1;
                if (colorCountsInCell[colorKey] > maxCount) {
                    maxCount = colorCountsInCell[colorKey];
                    dominantColorRgb = { r, g, b };
                }
            }
        }
    }

    if (pixelCount === 0) {
        return null; // 区域内没有不透明像素
    }

    if (mode === PixelationMode.Average) {
        return {
            r: Math.round(rSum / pixelCount),
            g: Math.round(gSum / pixelCount),
            b: Math.round(bSum / pixelCount),
        };
    } else { // Dominant mode
        return dominantColorRgb; // 可能为 null 如果只有一个透明像素
    }
}

/**
 * 根据原始图像数据、网格尺寸、调色板和模式计算像素化网格数据。
 * @param originalCtx 原始图像的 Canvas 2D Context
 * @param imgWidth 原始图像宽度
 * @param imgHeight 原始图像高度
 * @param N 网格横向数量
 * @param M 网格纵向数量
 * @param palette 当前使用的调色板
 * @param mode 像素化模式 (Dominant/Average)
 * @param t1FallbackColor T1 或其他备用颜色数据
 * @returns 计算后的 MappedPixel 网格数据
 */
export function calculatePixelGrid(
    originalCtx: CanvasRenderingContext2D,
    imgWidth: number,
    imgHeight: number,
    N: number,
    M: number,
    palette: PaletteColor[],
    mode: PixelationMode,
    t1FallbackColor: PaletteColor // 传入备用色
): MappedPixel[][] {
    console.log(`Calculating pixel grid with mode: ${mode}`);
    const mappedData: MappedPixel[][] = Array(M).fill(null).map(() => Array(N).fill({ key: t1FallbackColor.key, color: t1FallbackColor.hex }));
    const cellWidthOriginal = imgWidth / N;
    const cellHeightOriginal = imgHeight / M;

    let fullImageData: ImageData | null = null;
    try {
        fullImageData = originalCtx.getImageData(0, 0, imgWidth, imgHeight);
    } catch (e) {
        console.error("Failed to get full image data:", e);
        // 如果无法获取图像数据，返回一个空的或默认的网格
        return mappedData;
    }

    for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
            const startXOriginal = Math.floor(i * cellWidthOriginal);
            const startYOriginal = Math.floor(j * cellHeightOriginal);
            // 计算精确的单元格结束位置，避免超出图像边界
            const endXOriginal = Math.min(imgWidth, Math.ceil((i + 1) * cellWidthOriginal));
            const endYOriginal = Math.min(imgHeight, Math.ceil((j + 1) * cellHeightOriginal));
            // 计算实际的单元格宽高
            const currentCellWidth = Math.max(1, endXOriginal - startXOriginal);
            const currentCellHeight = Math.max(1, endYOriginal - startYOriginal);

            // 使用提取的函数计算代表色
            const representativeRgb = calculateCellRepresentativeColor(
                fullImageData,
                startXOriginal,
                startYOriginal,
                currentCellWidth,
                currentCellHeight,
                mode
            );

            let finalCellColorData: MappedPixel;
            if (representativeRgb) {
                const closestBead = findClosestPaletteColor(representativeRgb, palette);
                // 🚨 源头强制绑定真实色号
                finalCellColorData = { 
                    key: closestBead.code || closestBead.mardKey || closestBead.key, 
                    code: closestBead.code || closestBead.mardKey || closestBead.key,
                    color: closestBead.hex, 
                    mardKey: closestBead.mardKey || closestBead.code || closestBead.key 
                };
            } else {
                // 如果单元格为空或全透明，标记为透明/外部
                finalCellColorData = { ...transparentColorData };
            }
            mappedData[j][i] = finalCellColorData;
        }
    }
    console.log(`Pixel grid calculation complete for mode: ${mode}`);
    return mappedData;
}

// --- 精简降噪：3x3 智能合并 ---
export function removeSpeckles(matrix: any[][]): any[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = JSON.parse(JSON.stringify(matrix));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const self = matrix[y][x].code;
      const neighbors: Record<string, number> = {};
      
      // 检查 3x3 邻域
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            const code = matrix[ny][nx].code;
            neighbors[code] = (neighbors[code] || 0) + 1;
          }
        }
      }

      const sorted = Object.entries(neighbors).sort((a, b) => b[1] - a[1]);
      const mostCommonCode = sorted[0][0];

      // 如果当前颜色在周围 9 格中出现不到 3 次，说明是孤立碎点
      if (neighbors[self] < 3) {
        const winnerColor = matrix.flat().find(m => m.code === mostCommonCode);
        newMatrix[y][x] = { ...winnerColor, x, y };
      }
    }
  }
  return newMatrix;
}

// --- 合并低频色（解决"1颗、2颗"问题）---
export function mergeInfrequentColors(matrix: any[][], minCount: number = 5): any[][] {
  const flat = matrix.flat();
  const counts: Record<string, number> = {};
  flat.forEach(item => counts[item.code] = (counts[item.code] || 0) + 1);

  const rareCodes = Object.keys(counts).filter(code => counts[code] < minCount);
  if (rareCodes.length === 0) return matrix;

  const frequentColors = flat.filter(item => !rareCodes.includes(item.code));
  if (frequentColors.length === 0) return matrix;

  const newMatrix = JSON.parse(JSON.stringify(matrix));
  for (let y = 0; y < newMatrix.length; y++) {
    for (let x = 0; x < newMatrix[0].length; x++) {
      if (rareCodes.includes(newMatrix[y][x].code)) {
        const targetRgb = newMatrix[y][x].rgb;
        let bestColor = frequentColors[0];
        let minDistance = Infinity;

        // 在大部队颜色中找最接近的一个
        frequentColors.forEach(fc => {
          const d = colorDistance(targetRgb, fc.rgb);
          if (d < minDistance) {
            minDistance = d;
            bestColor = fc;
          }
        });
        newMatrix[y][x] = { ...bestColor, x, y };
      }
    }
  }
  return newMatrix;
}

/**
 * 品牌内限色：从指定品牌色板中筛选出最适合本图的 16 个颜色
 */
export function limitToBrandPalette(
  matrix: any[][], 
  activePalette: PaletteColor[], 
  maxColors: number = 16
): any[][] {
  const flat = matrix.flat();
  const counts: Record<string, number> = {};
  
  // 1. 统计当前图像中，品牌色板里哪些色号被用到了
  flat.forEach(item => {
    counts[item.code] = (counts[item.code] || 0) + 1;
  });

  // 2. 找出频率最高的 N 个色号
  const topCodes = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(entry => entry[0]);

  // 3. 获取这 Top-N 色号的完整信息
  const finalPalette = activePalette.filter(p => topCodes.includes(p.key));

  const newMatrix = JSON.parse(JSON.stringify(matrix));

  // 4. 强制重映射
  for (let y = 0; y < newMatrix.length; y++) {
    for (let x = 0; x < newMatrix[0].length; x++) {
      if (!topCodes.includes(newMatrix[y][x].code)) {
        const targetRgb = newMatrix[y][x].rgb;
        let bestColor = finalPalette[0];
        let minDistance = Infinity;

        finalPalette.forEach(fp => {
          const d = colorDistance(targetRgb, fp.rgb);
          if (d < minDistance) {
            minDistance = d;
            bestColor = fp;
          }
        });
        newMatrix[y][x] = { ...bestColor, x, y };
      }
    }
  }
  return newMatrix;
}

// --- 众数滤波：少数服从多数，让色块凝聚 ---
export function applyModeFilter(matrix: any[][]): any[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = JSON.parse(JSON.stringify(matrix));

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const counts: Record<string, { count: number, data: any }> = {};
      
      // 检查周围 3x3 的邻域
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = matrix[y + dy][x + dx];
          if (!counts[cell.code]) {
            counts[cell.code] = { count: 0, data: cell };
          }
          counts[cell.code].count++;
        }
      }

      // 找到 9 宫格内出现次数最多的色号
      const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
      const winner = sorted[0];

      // 强制同化：少数派直接改成赢家的颜色
      newMatrix[y][x] = { ...winner.data, x, y };
    }
  }
  return newMatrix;
}

// --- 强力孤岛合并：彻底消灭脸上和胳膊上的碎点 ---
export function removeSmallIslands(matrix: any[][], minSize: number = 8): any[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = JSON.parse(JSON.stringify(matrix));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!visited[y][x]) {
        const targetCode = matrix[y][x].code;
        const component: {x: number, y: number}[] = [];
        const queue = [{x, y}];
        visited[y][x] = true;

        // BFS 找连通域
        while (queue.length > 0) {
          const curr = queue.shift()!;
          component.push(curr);
          [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
            const nx = curr.x + dx, ny = curr.y + dy;
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !visited[ny][nx] && matrix[ny][nx].code === targetCode) {
              visited[ny][nx] = true;
              queue.push({x: nx, y: ny});
            }
          });
        }

        // 如果这个颜色块连在一起不到 minSize 颗，说明是噪点，强制合并
        if (component.length < minSize) {
          const neighbors: Record<string, number> = {};
          component.forEach(p => {
            [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
              const nx = p.x + dx, ny = p.y + dy;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && matrix[ny][nx].code !== targetCode) {
                const code = matrix[ny][nx].code;
                neighbors[code] = (neighbors[code] || 0) + 1;
              }
            });
          });
          const sorted = Object.entries(neighbors).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) {
            const winnerCode = sorted[0][0];
            const winnerData = matrix.flat().find(m => m.code === winnerCode);
            component.forEach(p => {
              newMatrix[p.y][p.x] = { ...winnerData, x: p.x, y: p.y };
            });
          }
        }
      }
    }
  }
  return newMatrix;
}

// --- 新增：矩阵平滑函数（去除零碎麻点） ---
export function smoothBeadMatrix(matrix: any[][]): any[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = JSON.parse(JSON.stringify(matrix));

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const self = matrix[y][x].code;
      const neighbors = [
        matrix[y - 1][x].code, matrix[y + 1][x].code,
        matrix[y][x - 1].code, matrix[y][x + 1].code
      ];
      // 如果上下左右四个邻居颜色都一样，但和自己不一样
      if (neighbors.every(n => n === neighbors[0]) && self !== neighbors[0]) {
        newMatrix[y][x] = { ...matrix[y - 1][x], x, y }; // 强制同化
      }
    }
  }
  return newMatrix;
}

// --- 新增：中值降噪函数（磨皮效果，去除孤立噪点） ---
export function denoiseMatrix(matrix: any[][]): any[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const newMatrix = JSON.parse(JSON.stringify(matrix));

  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const counts: Record<string, number> = {};
      // 统计周围 3x3 区域的颜色分布
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const code = matrix[y + dy][x + dx].code;
          counts[code] = (counts[code] || 0) + 1;
        }
      }
      const currentCode = matrix[y][x].code;
      // 如果当前点是孤独的（周围出现次数少于 3 次），强制改为周围最多的颜色
      if (counts[currentCode] < 3) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const dominantCode = sorted[0][0];
        newMatrix[y][x].code = dominantCode;
        // 同步更新 hex 颜色
        newMatrix[y][x].color = matrix[y - 1][x].color;
      }
    }
  }
  return newMatrix;
}

// --- 新增：RGB转Hex（辅助函数） ---
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// --- 新增：轮廓增强函数（深色吸附到纯黑） ---
export function enhanceOutlines(rgb: RgbColor): RgbColor {
  const { r, g, b } = rgb;
  // 如果 RGB 三值都小于 80，直接判定为黑色
  if (r < 80 && g < 80 && b < 80) {
    return { r: 0, g: 0, b: 0 };
  }
  return rgb;
}

// --- 终极降噪流水线：精准识别 -> 区域平滑 -> 孤岛强力清除 ---
export function fullDenoisePipeline(matrix: any[][], currentPalette: PaletteColor[]): any[][] {
  let result = JSON.parse(JSON.stringify(matrix));
  
  // 第一步：不再限色，直接根据 Lab 空间在 currentPalette 中进行精准全局映射
  // (映射逻辑已通过升级 colorDistance 自动生效)

  // 第二步：众数平滑（跑一遍，消除单个碎点）
  result = applyModeFilter(result);
  
  // 第三步：【核心修复】强力孤岛合并
  // 凡是少于 10 颗连在一起的杂色点/块，全部强制抹除！
  result = removeSmallIslands(result, 10); 
  
  return result;
}

// --- 终极杀招：色块聚合（Cluster Cleanup）---
export function consolidateColors(matrix: any[][], minCount: number = 8): any[][] {
  const flat = matrix.flat();
  const counts: Record<string, number> = {};
  flat.forEach(p => counts[p.code] = (counts[p.code] || 0) + 1);

  // 找出那些全图出现不到 8 颗的颜色
  const rareCodes = Object.keys(counts).filter(code => counts[code] < minCount);
  if (rareCodes.length === 0) return matrix;

  const frequentColors = flat.filter(p => !rareCodes.includes(p.code));
  const newMatrix = JSON.parse(JSON.stringify(matrix));
  const rows = newMatrix.length;
  const cols = newMatrix[0].length;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (rareCodes.includes(newMatrix[y][x].code)) {
        // 找到最近的常用色
        const targetRgb = newMatrix[y][x].rgb;
        let best = frequentColors[0];
        let minD = Infinity;
        frequentColors.forEach(fc => {
          const d = colorDistance(targetRgb, fc.rgb);
          if (d < minD) { minD = d; best = fc; }
        });
        newMatrix[y][x] = { ...best, x, y };
      }
    }
  }
  return newMatrix;
} 
