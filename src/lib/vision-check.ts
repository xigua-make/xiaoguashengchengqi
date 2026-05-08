/**
 * 基础视觉检查
 * 用于第一段 AI 优化后的基础规则校验
 * 避免空图、疑似多人、无法读取等离谱情况
 */

import axios from 'axios';
import sharp from 'sharp';

export interface VisionCheckResult {
  passed: boolean;
  reason: string;
}

/**
 * 检查 AI 优化后的图片是否有效
 */
export async function checkOptimizedImage(imageUrl: string): Promise<VisionCheckResult> {
  try {
    console.log('[vision-check] 开始检查图片:', imageUrl);

    // 1. 检查图片是否存在且可访问
    let buffer: Buffer;
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      buffer = Buffer.from(response.data);
    } catch (err) {
      console.error('[vision-check] 图片下载失败');
      return {
        passed: false,
        reason: '图片无法访问或下载失败'
      };
    }

    if (!buffer || buffer.length < 1000) {
      console.error('[vision-check] 图片数据异常（小文件）');
      return {
        passed: false,
        reason: '图片数据异常，可能是空图'
      };
    }

    // 2. 尝试读取图片尺寸
    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch (err) {
      console.error('[vision-check] 无法读取图片元数据');
      return {
        passed: false,
        reason: '无法读取图片格式'
      };
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    console.log('[vision-check] 图片尺寸:', width, 'x', height);

    if (width < 64 || height < 64) {
      console.error('[vision-check] 图片尺寸太小');
      return {
        passed: false,
        reason: `图片尺寸过小 (${width}x${height})，可能处理失败`
      };
    }

    // 3. 检查是否为空白图（通过分析颜色分布）
    try {
      const stats = await sharp(buffer)
        .resize(64, 64, { fit: 'cover' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true })
        .then(async ({ data, info }) => {
          // 计算灰度值分布
          const values = new Array(256).fill(0);
          for (let i = 0; i < data.length; i++) {
            values[data[i]]++;
          }
          // 检查是否有颜色过度集中
          const maxRatio = Math.max(...values) / data.length;
          // 计算方差
          const mean = data.reduce((a, b) => a + b, 0) / data.length;
          const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length;
          return { maxRatio, variance };
        });

      console.log('[vision-check] 颜色分布 - 最大占比:', stats.maxRatio, ', 方差:', stats.variance);

      // 如果颜色过度集中（可能是纯色图）
      if (stats.maxRatio > 0.95) {
        console.error('[vision-check] 检测到颜色过度集中，可能是纯色图');
        return {
          passed: false,
          reason: '图片可能为空白或纯色图'
        };
      }

      // 如果方差过小（可能是渐变图）
      if (stats.variance < 100) {
        console.error('[vision-check] 检测到方差过小，可能是渐变图');
        return {
          passed: false,
          reason: '图片可能为渐变或模糊图'
        };
      }

    } catch (err) {
      console.warn('[vision-check] 颜色分析跳过:', err);
      // 颜色分析失败不阻断，继续检查
    }

    // 4. 基础规则校验通过
    console.log('[vision-check] 基础检查通过');
    return {
      passed: true,
      reason: '基础规则校验通过'
    };

  } catch (error) {
    console.error('[vision-check] 检查异常:', error);
    return {
      passed: false,
      reason: `检查过程异常: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 简单检查图片是否为空白/纯色
 * 通过采样分析
 */
export async function isBlankImage(buffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(32, 32, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 计算颜色变化
    let changes = 0;
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i] - data[i - 1]);
      if (diff > 5) changes++;
    }

    const changeRatio = changes / (data.length - 1);
    console.log('[isBlankImage] 变化率:', changeRatio);

    // 变化率低于5%认为是空白图
    return changeRatio < 0.05;
  } catch {
    return false;
  }
}
