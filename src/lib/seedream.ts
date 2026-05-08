// ============================================
// Seedream API 调用模块
// ============================================

import { mkdir, writeFile, copyFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { MARD_221_COLORS, CSV_MARD_COLORS } from './color-palettes';
import { getPixelPortraitSpec } from './pattern-size';

// 环境变量
const SEEDREAM_API_URL = process.env.SEEDREAM_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const SEEDREAM_API_KEY = process.env.SEEDREAM_API_KEY;
const SEEDREAM_MODEL = process.env.SEEDREAM_MODEL || 'doubao-seedream-5-0-260128';

// 调试：打印实际使用的 API Key（只打印前10位）
console.log('[DEBUG] SEEDREAM_API_KEY 实际值:', SEEDREAM_API_KEY ? SEEDREAM_API_KEY.substring(0, 10) + '...' : 'undefined');
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '180000', 10);
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'outputs');

// pixelPortrait 默认风格参考图（相对路径，前端需要拼接域名）
export const DEFAULT_REFERENCE_IMAGE_PATH = '/reference/pixel-portrait-style.png';

// ============================================
// 色板预设系统（支持多品牌显示）
// ============================================

// 品牌类型
export type Brand = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

// 单个颜色条目（带多品牌显示码）
export interface PaletteColor {
  masterCode: string;       // 内部主色号（MARD）
  rgb: [number, number, number];  // RGB 值
  hex?: string;             // HEX 值（可选）
  displayCodes: Record<string, string>;  // 各品牌显示色号
}

// 色板预设
export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  codes: string[];  // MARD 色号列表
  rgbMap: Record<string, [number, number, number]>;  // 色号 -> RGB（向后兼容）
}

// 获取预设中所有颜色的 RGB 数组（用于 Python 匹配）
export function getPaletteRgbList(presetId: string): [number, number, number][] {
  const preset = PALETTE_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    return [];
  }
  return preset.codes.map(code => preset.rgbMap[code]);
}

// 获取预设中所有颜色的 RGB 映射（色号 -> RGB）
export function getPaletteRgbMapById(presetId: string): Record<string, [number, number, number]> | null {
  const preset = PALETTE_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    return null;
  }
  return preset.rgbMap;
}

// 获取预设中所有颜色的完整信息（带 displayCodes）
export function getPaletteColors(presetId: string): PaletteColor[] {
  const preset = PALETTE_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    return [];
  }

  // 动态导入 color-code-map 以获取品牌映射
  let displayCodeMap: Record<string, Record<string, string>> = {};
  try {
    const { getAllColorMappings } = require('./color-code-map');
    const mappings = getAllColorMappings();
    mappings.forEach((m: { masterCode: string; displayCodes: Record<string, string> }) => {
      displayCodeMap[m.masterCode] = m.displayCodes;
    });
  } catch (e) {
    // 如果加载失败，使用空映射
  }

  return preset.codes.map(code => ({
    masterCode: code,
    rgb: preset.rgbMap[code],
    displayCodes: displayCodeMap[code] || { MARD: code }
  }));
}

// 获取预设的色号列表
export function getPaletteCodes(presetId: string): string[] | null {
  const preset = PALETTE_PRESETS.find(p => p.id === presetId);
  return preset ? preset.codes : null;
}

// 获取预设的颜色数量
export function getPaletteColorCount(presetId: string): number {
  const preset = PALETTE_PRESETS.find(p => p.id === presetId);
  return preset ? preset.codes.length : 0;
}

// 从参考图提取的核心色板（像素大头经典）
const PIXEL_PORTRAIT_CLASSIC_CODES = [
  'W',   // 白色 - 背景
  '1',   // 浅灰白 - 高光
  '2',   // 浅灰 - 眼白
  '3',   // 中灰 - 细节
  'K',   // 黑色 - 轮廓
  '7',   // 深灰60 - 头发
  '8',   // 深灰30 - 头发暗部
  '9',   // 深灰10 - 轮廓暗部
  '122', // 浅肤色 - 皮肤
  '162', // 中肤色 - 皮肤阴影
  '137', // 暖肤色 - 皮肤过渡
  '113', // 暖白 - 细节
  '12',  // 浅粉150 - 腮红/嘴巴
  '65',  // 浅粉 - 腮红
  '193', // 粉色 - 腮红柔和
  '140', // 暖棕 - 暗部
];

// 粉嫩系色板
const PIXEL_PORTRAIT_SWEET_CODES = [
  'W', '1', '2', '3', 'K', '7', '8',
  '121', '122', '123', '145', '146',  // 肤色系
  '11', '12', '65', '66', '193', '194', // 粉色系
  '137', '138',  // 暖色
  '113',  // 暖白
];

// 冷调色板
const PIXEL_PORTRAIT_COOL_CODES = [
  'W', '1', '2', '3', '4', 'K', '7', '8', '9',
  '129', '130', '131',  // 冷肤色
  '45', '46', '47',     // 冷色
  '105', '106', '107',  // 蓝灰
  '113', '114', '115',  // 灰棕
  '12', '65',           // 粉色
];

// 暗色调色板
const PIXEL_PORTRAIT_DARK_CODES = [
  'W', '1', '2',
  'K', '7', '8', '9', '10',  // 深色系
  '5', '6',                  // 中灰
  '113', '114', '115', '116', '117', // 灰棕系
  '137', '138', '139', '140', // 暖棕系
  '12', '65',                // 粉色
  '122',                     // 肤色
];

// MARD 221 完整色板（字母色号 + 数字 1-221）
const MARD_221_CODES = [
  // 字母色号
  'W', 'C', 'M', 'Y', 'K', 'R', 'O', 'Y2', 'YG', 'G', 'BG', 'B', 'V', 'LB', 'P', 'LG',
  'LGY', 'GY', 'GRAY', 'BR', 'PK', 'A', 'AP',
  // 数字色号 1-221
  ...Array.from({length: 221}, (_, i) => String(i + 1))
];

// 导出色板预设
export const PALETTE_PRESETS: PalettePreset[] = [
  // 291 色：完整 CSV 色号对应表
  {
    id: '291',
    name: '完整色板 291',
    description: 'CSV 色号对应表完整 291 色，包含所有品牌色号',
    codes: [],
    rgbMap: {}
  },
  // 221 色
  {
    id: '221',
    name: '221 色板',
    description: '精选 221 色调色板',
    codes: [],
    rgbMap: {}
  },
  // 144 色
  {
    id: '144',
    name: '144 色精简',
    description: '精选 144 色调色板',
    codes: [],
    rgbMap: {}
  },
  // 120 色
  {
    id: '120',
    name: '120 色基础',
    description: '基础 120 色调色板',
    codes: [],
    rgbMap: {}
  }
];

// ============================================
// 动态加载预设颜色（从 CSV 加载）
// ============================================
// 加载 CSV 色号到各预设
try {
  const { getAllMardCodes, getAllColorMappings } = require('./color-code-map');
  const csvMardCodes = getAllMardCodes();
  const allMappings = getAllColorMappings();
  
  // 291 色预设：使用 CSV 完整色表
  const preset291 = PALETTE_PRESETS.find(p => p.id === '291');
  if (preset291 && csvMardCodes.length > 0) {
    preset291.codes = csvMardCodes;
    preset291.rgbMap = Object.fromEntries(
      csvMardCodes
        .filter(code => CSV_MARD_COLORS[code])
        .map(code => [code, CSV_MARD_COLORS[code]])
    ) as Record<string, [number, number, number]>;
    console.log(`[seedream] Loaded ${Object.keys(preset291.rgbMap).length} colors for 291 preset`);
  }
  
  // 221 色预设：从 291 颜色中精选
  const preset221 = PALETTE_PRESETS.find(p => p.id === '221');
  if (preset221 && csvMardCodes.length > 0) {
    // 精选 221 色：均匀分布
    const selectEveryN = Math.floor(csvMardCodes.length / 221);
    const codes221 = csvMardCodes.filter((_: string, i: number) => i % selectEveryN < 2).slice(0, 221);
    preset221.codes = codes221;
    preset221.rgbMap = Object.fromEntries(
      codes221
        .filter(code => CSV_MARD_COLORS[code])
        .map(code => [code, CSV_MARD_COLORS[code]])
    ) as Record<string, [number, number, number]>;
    console.log(`[seedream] Loaded ${codes221.length} colors for 221 preset`);
  }
  
  // 144 色预设：从 291 颜色中精选（按色系均匀分布）
  const preset144 = PALETTE_PRESETS.find(p => p.id === '144');
  if (preset144 && csvMardCodes.length > 0) {
    const selectEveryN = Math.floor(csvMardCodes.length / 144);
    const codes144 = csvMardCodes.filter((_: string, i: number) => i % selectEveryN < 2).slice(0, 144);
    preset144.codes = codes144;
    preset144.rgbMap = Object.fromEntries(
      codes144
        .filter(code => CSV_MARD_COLORS[code])
        .map(code => [code, CSV_MARD_COLORS[code]])
    ) as Record<string, [number, number, number]>;
    console.log(`[seedream] Loaded ${codes144.length} colors for 144 preset`);
  }
  
  // 120 色预设：从 291 颜色中精选（按色系均匀分布）
  const preset120 = PALETTE_PRESETS.find(p => p.id === '120');
  if (preset120 && csvMardCodes.length > 0) {
    const selectEveryN = Math.floor(csvMardCodes.length / 120);
    const codes120 = csvMardCodes.filter((_: string, i: number) => i % selectEveryN < 2).slice(0, 120);
    preset120.codes = codes120;
    preset120.rgbMap = Object.fromEntries(
      codes120
        .filter(code => CSV_MARD_COLORS[code])
        .map(code => [code, CSV_MARD_COLORS[code]])
    ) as Record<string, [number, number, number]>;
    console.log(`[seedream] Loaded ${codes120.length} colors for 120 preset`);
  }
  
} catch (e) {
  console.warn('[seedream] Failed to load palette presets from CSV:', e);
}

// 确保目录存在
if (!existsSync(OUTPUT_DIR)) {
  mkdir(OUTPUT_DIR, { recursive: true }).catch(console.error);
}

// ============================================
// AI 模式配置
// ============================================

export const AI_MODE_LABELS: Record<string, string> = {
  pixelFullBody: '像素全身',
  pixelPortrait: '像素大头',
  pixelDoll: '像素豆灵',
  cartoon: '卡通'
};

// 各模式的尺寸配置
// 注意：Seedream 要求图片尺寸至少 3686400 像素
// 正方形: 2048x2048 = 4,194,304 像素 (满足要求，支持精细像素画)
// portrait: 1920x2880 = 5,529,600 像素 (2:3 竖版)
// aspect: 1920x2400 = 4,608,000 像素 (4:5 竖版)
export const AI_MODE_SIZES: Record<string, string> = {
  pixelFullBody: '1920x2880',  // 2:3 竖版，适合全身
  pixelPortrait: '2048x2048',   // 正方形，强制大头模式，支持精细像素画
  pixelDoll: '2048x2048',      // 正方形，强制豆灵模式
  cartoon: '2048x2048'         // 正方形，适合卡通
};

// 各模式的配置详情
export const AI_MODE_CONFIG: Record<string, {
  label: string;
  seedreamSizeType: 'square' | 'portrait' | 'aspect';
  patternSizeType: 'square' | 'aspect';
  inputCropType: 'original' | 'head' | 'subject';
  description: string;
}> = {
  pixelFullBody: {
    label: '像素全身',
    seedreamSizeType: 'portrait',
    patternSizeType: 'aspect',
    inputCropType: 'original',
    description: '适合全身角色、完整造型，按比例计算图纸尺寸'
  },
  pixelPortrait: {
    label: '像素大头',
    seedreamSizeType: 'square',
    patternSizeType: 'square',
    inputCropType: 'head',
    description: '强制正方形，图纸尺寸固定 maxSide×maxSide'
  },
  pixelDoll: {
    label: '像素豆灵',
    seedreamSizeType: 'square',
    patternSizeType: 'square',
    inputCropType: 'subject',
    description: '强制正方形，图纸尺寸固定 maxSide×maxSide'
  },
  cartoon: {
    label: '卡通',
    seedreamSizeType: 'square',
    patternSizeType: 'square',
    inputCropType: 'original',
    description: '强制正方形 52x52，极简大色块风'
  }
};

// ============================================
// Prompt 模板
// ============================================

export const STYLE_PROMPTS: Record<string, string> = {
  pixelFullBody: `【核心指令】Image-to-Image translation. Target style: 16-bit RPG character sprite, Perler beads pattern style.
Image A (Original) = 用户真实照片，提取服装和特征。
Image B (Reference) = 像素风参考图，提取画风。
【面部与肤色强制保护 (生死攸关)】(bright fair skin tone, natural warm skin color:1.8), (flat front lighting, absolutely no shadows on face:1.8)。必须保持人物肤色明亮、白皙、健康！面部绝对禁止出现灰暗、发黑、发土的色调，绝对禁止面部有任何阴影！
【画风强制克隆】完美克隆 Image B：2.5头身，正面站立。(crisp hard edges:1.5), (no anti-aliasing:1.5), 极简大色块平涂。
【背景与轮廓】(solid pure white background:1.8)。人物外层必须有极粗的闭合纯黑轮廓线 (thick solid black outline:1.8) 将人物与白色背景彻底隔绝！绝对禁止衣服的白色与背景白色融合！`,

  pixelDoll: `【核心指令】Image-to-Image translation. Target style: 16-bit chibi pixel doll character, Perler beads pattern style.
Image A (Original) = 用户真实照片，提取服装和面部特征。
Image B (Reference) = 像素风大头玩偶参考图，提取画风与极其夸张的头身比。
【特征提取】提取 Image A 的发型、发色、服装主要款式与颜色。因为身子变小了，衣服细节可适当简化，但大体颜色必须对准。
【画风强制克隆】必须完美克隆 Image B 的画风：
1. 极端的 Q 版比例：头极大、身体极小 (huge head, tiny body, chibi doll proportion)。
2. 极粗且完全闭合的纯黑外轮廓线 (thick solid black outline)，将人物与背景彻底隔离开！
3. 极简大色块平涂。(crisp hard edges:1.5), (no anti-aliasing:1.5)。
【面部与肤色保护】(bright fair skin tone:1.8), (flat front lighting, no shadows:1.8)。禁止面部发黑发土，禁止面部阴影，五官必须高度萌化、极简。
【背景要求】(solid pure white background:1.8)。纯白背景，严禁衣服的白色与背景白色融合。`,

  cartoon: `【核心指令】Image-to-Image translation. Target style: Minimalist retro 16-bit anime character sprite.
Image A (Original) = 用户真实照片，提取特征。
Image B (Reference) = 像素风参考图，提取画风。
【画风强制克隆 (生死攸关)】必须完美克隆 Image B 的正方形画风：
1. (ultra-low resolution pixel art:1.8), (massive chunky pixel blocks:1.8). 绝对禁止生成高清伪像素！必须是极其粗犷、巨大的像素方块！能完美适配 50x50 的低分辨率网格！
2. 极粗且完全闭合的纯黑外轮廓线 (thick solid black outline:1.8)。
3. (crisp hard edges:1.5), 极简大色块平涂，禁止任何渐变！绝对禁止画复杂的发丝和衣服褶皱！
【面部与背景】(bright fair skin tone:1.5), 面部保持明亮平光，禁止阴影。(solid pure white background:1.8)。纯白背景。`,

  cutePet: `【核心指令】Image-to-Image translation. Target style: 16-bit kawaii chibi pet sprite, cute doll-like animal, Perler beads pattern style.
Image A (Original) = 用户真实的宠物照片，提取宠物的品种和主要毛色。
Image B (Reference) = 像素风萌宠参考图，提取画风。
【Q版萌化强制转换 (生死攸关)】绝对禁止生成写实比例的动物！必须将原图宠物转化为极度可爱的 Q 版玩偶形态：
1. 极端的 Q 版比例：(huge head, big cute eyes, round chubby body:1.8), (kawaii chibi doll style:1.8)。必须圆润、呆萌，像可爱的动物之森小动物或挂件！
2. 细节极度简化：(simplify whiskers and fur:1.8)。绝对禁止画出写实的长胡须和杂乱毛发！胡须必须省略，或极度简化为可爱的 1-2 个像素点！
【画风与网格要求】必须完美克隆 Image B 的画风：
1. (low resolution pixel art:1.5), (chunky pixel blocks:1.5)。色块巨大，大幅精简颜色。
2. 极粗且完全闭合的纯黑外轮廓线 (thick solid black outline:1.8)。
3. (crisp hard edges:1.5), 极简大色块平涂，禁止渐变！
【背景要求】(solid pure white background:1.8)。纯白背景。`,

  carStyle: `【核心指令】Image-to-Image translation. Target style: Minimalist retro 16-bit car sprite, Perler beads pattern style.
Image A (Original) = 用户真实的汽车照片，提取车型轮廓、品牌特征、车身颜色和细节部件（如车灯、中网、轮毂）。
Image B (Reference) = 像素风汽车参考图，提取画风与【极低分辨率网格】。
【画风强制克隆 (生死攸关)】必须完美克隆 Image B 的画风：
1. (ultra-low resolution pixel art:1.8), (massive chunky pixel blocks:1.8). 绝对禁止生成高清伪像素或过度写实！必须是极其粗犷、巨大的像素方块！能完美适配 50x50 的低分辨率网格！
2. 极粗且完全闭合的纯黑外轮廓线 (thick solid black outline:1.8)。
3. (crisp hard edges:1.5), 极简大色块平涂，禁止任何渐变！必须去除真实的金属反光、车身倒影和环境光，车身和车窗的反光必须极简化为 1-2 种纯净的色块！
【背景要求】(solid pure white background:1.8)。纯白背景，底部可带极其简单的纯深色阴影色块，严禁车身颜色与背景白色融合。`
};

// ============================================
// pixelPortrait Q版单人 Prompt 生成器
// ============================================

/**
 * 生成 pixelPortrait 模式的 prompt - Q版像素小人风格（带风格参考图版本）
 * @param targetSize 目标图纸尺寸（如 52、60、80）
 * @param hasReferenceImage 是否传入了风格参考图
 */

// pixelPortrait 专用 prompt 生成
const NEGATIVE_PROMPT_PIXEL_PORTRAIT = `
realistic proportion, realistic anatomy, half body realistic portrait,
ordinary cartoon portrait, high resolution anime illustration, semi-realistic illustration,
detailed fingers, realistic hands, complex arms, complex clothing folds,
realistic eyes, detailed hair strands, detailed eyelashes,
smooth gradients, soft shading, soft edges, soft outline, smooth edges,
photographic, realistic skin texture, watercolor, watercolor effect,
blurry edges, blurry pixels, fuzzy pixels, fuzzy outline,
wash watercolor blur, color bleeding, color smudge,
low contrast, washed out colors, dull colors, muted colors,
complex background, background scenery, multiple figures,
text, watermark, grid, color numbers, bead grid,
clothing patterns, necklace, earrings, complex accessories,
facial deformity, missing facial features, broken face, distorted face,
incomplete body, broken body, fragmented body, scrambled pixels,
pixel artifacts, corrupted pixels, glitch art
`.trim();

// 通用负向 Prompt
const NEGATIVE_PROMPT = `
realistic proportion, realistic anatomy, half body realistic portrait,
ordinary cartoon portrait, high resolution anime illustration, semi-realistic illustration,
detailed fingers, realistic hands, complex arms, complex clothing folds,
realistic eyes, detailed hair strands, smooth gradients, soft shading, complex shading,
photographic, realistic skin texture, watercolor, blurry edges, soft outline,
complex background, background scenery, multiple figures,
text, watermark, grid, color numbers, bead grid,
clothing patterns, necklace, earrings, complex accessories
`.trim();

// pixelPortrait 专用 prompt 生成 - 最终版
// 核心原则：让 AI 从源头画出接近最终拼豆图纸效果的作品
function buildPixelPortraitPrompt(targetSize: number, hasReferenceImage: boolean = false): string {
  const size = targetSize || 52;

  return `Image A = 用户上传的真人照片（人物身份与姿势参考）。
Image B = 像素大头风格参考图（画风、比例、轮廓、细节处理参考）。

请严格参考 Image B 的整体画风，把 Image A 中的人物重新绘制成一张"高完成度、干净、清晰、低杂色、Q版像素大头角色图"。

这不是普通照片缩小。
这不是简单像素化。
这不是马赛克。
这不是把照片模糊后量化颜色。
这必须是一张"重新设计并重新绘制"的像素大头角色图，视觉上要接近高质量拼豆图纸效果，像人工精修过的像素头像。

【总目标】
生成结果必须满足以下核心目标：
- Q版像素大头风格
- 大头小身
- 五官清楚
- 粗黑轮廓
- 大色块、少杂色
- 扁平化、图标化、符号化
- 小尺寸下依然清晰可读
- 看起来像专业整理过的拼豆像素图，而不是自动压缩后的照片

【最重要要求】
请在"当前已经较接近理想效果的基础上"，只做以下方向的强化优化，不要把风格改偏：
1. 进一步减少模糊感
2. 进一步减少杂色、乱点、脏色
3. 进一步提升眼部、手部、花朵等关键细节的可读性
4. 保持整体已经接近正确的角色造型、比例、轮廓、配色方向，不要大改风格
5. 只允许"优化清晰度与细节秩序"，不允许把图重新做成另一种风格

【人物整体造型】
- 人物为大头小身 Q版像素角色
- 头部明显大于身体
- 身体简化，小巧、可爱、易读
- 姿势保持与原图一致的大致关系
- 手的位置、花朵的位置、头发方向、脸部朝向都要保留
- 构图居中稳定，人物完整，画面干净
- 角色应像"拼豆可制作的小像素头像"，而不是写实人物

【风格基准】
请尽量接近以下视觉特征：
- 像素块清晰、边缘干净
- 大面积使用稳定纯净色块
- 少量、克制、设计过的内部细节
- 粗黑轮廓清楚包裹脸、头发、身体、手、花朵等主要结构
- 画面可爱、简洁、明亮
- 角色脸部非常醒目
- 不要出现发灰、发脏、发糊、发虚的感觉

【脸部要求】
- 脸型圆润、可爱、简洁
- 面部尽量保持平整的大色块
- 保留人物大致气质和脸部朝向
- 不要复杂鼻影、法令纹、皮肤纹理
- 脸颊可有适量粉色腮红
- 腮红必须是干净、集中、稳定的小色块
- 不要让脸上散布很多零碎颜色
- 不要在脸部生成杂乱单像素噪点

【眼部要求——极其重要】
- 眼睛必须是最清晰、最精致、最容易识别的部位之一
- 眼睛必须明显比真实比例更大，符合 Q版风格
- 眼睛要有清楚的黑色主体和白色高光
- 高光位置稳定、干净，不要随机散点
- 眼白、瞳孔、上眼线要明确
- 眼睛边缘要干净，不要出现杂乱灰点、脏色点、漂浮像素
- 左右眼风格一致，大小接近，对称感强
- 眉毛与眼睛之间关系要清楚
- 眼周不要出现很多无意义的碎色
- 如果缩小到小尺寸，眼睛依然必须一眼可辨
- 重点优化眼部乱点问题：减少眼角、下眼睑、眼周的脏色和随机噪点
- 让眼睛更像"设计过的卡通像素眼睛"，而不是从照片里硬缩出来的眼睛

【眉毛要求】
- 眉毛简化成干净的深色短条
- 位置稳定
- 不要毛发质感
- 不要一根一根画
- 形状略有弧度即可，清晰即可

【鼻子要求】
- 鼻子极度简化
- 只做非常弱的提示
- 可以近似忽略
- 不要真实高光和阴影
- 不要让鼻子成为噪点来源

【嘴巴要求】
- 嘴巴小而清楚
- 只用少量像素表达
- 可以是简洁可爱的短线或小形状
- 不要复杂嘴唇纹理
- 不要脏红色过渡
- 不要让嘴巴周边出现脏色

【头发要求】
- 必须保留原图的大致发型与分区
- 保留长发/短发、刘海方向、分缝方向等主要结构
- 头发要简化成干净的大块深色区域
- 内部允许少量高光，但必须是有设计感、整齐、克制的小块
- 禁止随机蓝点、脏绿点、脏灰点
- 禁止头发内部出现无意义细碎像素
- 头发边界要清楚、整齐
- 头发轮廓要稳定，不能软塌模糊
- 深发色要稳定，不要大面积颜色漂移
- 不要生成一堆看不懂的细碎亮点

【耳朵要求】
- 耳朵保留简化轮廓
- 可见即可
- 不追求写实结构
- 耳朵内部细节尽量少
- 耳朵边缘要干净
- 与头发和脸之间边界清楚

【手部要求——重点优化】
- 手是第二个重点优化区域
- 保留手托脸、拿花、交叠等大致动作关系
- 手部必须大幅简化，只保留"能读懂姿势"的关键形
- 不要真实手指结构
- 手指只需要暗示，不需要完整解剖
- 重点减少手部内部的乱点、杂色、脏块、断裂线
- 让手看起来像"Q版图标化的手"，不要像缩小失败的真实手
- 手背、手掌、手指之间只保留最必要的分界
- 如果花朵与手有重叠，优先保证轮廓清楚和阅读性
- 对所有手部小面积脏色、孤立点、无意义细节进行强力简化
- 手部轮廓要干净，边缘要顺，内部层次要少而清楚

【花朵 / 配饰要求——重点优化】
- 保留花朵的位置、颜色倾向和"花"的识别性
- 花朵必须图标化、简化、清楚
- 花瓣数量可适当简化
- 花瓣要合并成稳定的色块，不要到处散点
- 花心必须清楚可辨
- 紫色、黄色等花朵颜色要相对鲜明、干净
- 花朵边缘要尽量规整
- 减少花朵内部的小杂点和脏色过渡
- 花朵不追求真实，只追求"看起来像花、可爱、清楚"
- 若花朵过于复杂，请主动简化，但保留识别性
- 花朵和手之间边界必须尽量清晰

【服装要求】
- 保留衣服的大致类型和轮廓
- 衣服可简化为干净的大色块
- 白色衣服保持明亮整洁
- 删除衣服纹理、褶皱、材质噪点
- 不要让衣服沾染脏绿、脏灰、脏棕杂色
- 衣服边缘和皮肤边缘要清楚分开
- 衣服内不需要多余细节

【配色要求——极其重要】
- 整体颜色必须更干净、更整洁、更成组
- 不要颜色乱飞
- 不要大量孤立单像素颜色
- 不要同一小区域里出现太多相近但零碎的颜色
- 同一区域应尽量用较少、较稳定的颜色表达
- 肤色保持温暖、柔和、明亮、统一
- 头发颜色保持集中和稳定
- 腮红使用干净粉色
- 花朵使用清楚的主色
- 衣服颜色简洁
- 颜色要偏"可读性优先"，而不是"写实还原优先"

【颜色精简规则——必须执行】
请主动对颜色进行整理和吞并：
- 所有出现次数很少、面积很小、视觉作用弱的杂色，应尽量并入邻近主色
- 颜色多的区域可以吞并颜色少的区域
- 相近颜色要尽量合并
- 如果某个颜色只在很少几个像素上出现，且不影响关键特征表达，应优先合并到最邻近的主色
- 除非是眼睛高光、嘴巴、腮红、花心等关键点，否则不要保留很多"只出现几颗像素"的零碎颜色
- 同一区域应尽量减少颜色数量，提升整体整洁度
- 优先形成"头发主色、肤色主色、腮红主色、花朵主色、衣服主色"等清楚的颜色层级

【杂色清理要求——必须执行】
- 清理孤立单像素噪点
- 清理边缘附近的脏色
- 清理眼部周围的灰点、脏点
- 清理手部内部的无意义杂点
- 清理花朵周围的小脏块
- 清理衣服和皮肤交界处的脏色
- 清理头发内部的随机高亮点和脏灰点
- 清理大面积色块中突然出现的异色点
- 只保留真正服务识别性的细节
- 凡是影响"干净利落感"的点，都应该被减少

【轮廓要求】
- 外轮廓必须清楚、偏粗、稳定
- 脸、头发、身体、手、花朵都应有清楚边界
- 轮廓颜色以黑色或很深的深色为主
- 轮廓不要断裂
- 轮廓要尽量规整，不要虚边
- 内部结构线也应尽量清楚，但不能太乱
- 轮廓需要帮助人物在小图中快速被识别

【小尺寸适配】
最终图像是小尺寸像素图，类似 ${size} × ${size} 的图纸级别，因此必须优先考虑：
- 小图下能一眼认出人物
- 小图下五官依然清楚
- 小图下手部与花朵依然可读
- 小图下头发轮廓依然稳
- 小图下颜色不要发脏发灰
- 小图下不要过多内部细节
- 小图下尽量"清楚胜过写实"

如果目标尺寸接近 52：
- 强化简化
- 强化轮廓
- 强化眼睛识别
- 强化手和花的清晰度
- 大幅减少小面积杂色
- 优先保证可读性与干净度

如果目标尺寸更大：
- 可以稍多一点细节
- 但仍然必须保持干净、稳定、低杂色

【背景要求】
- 背景必须简单、干净、浅色
- 不要添加场景元素
- 不要添加无关装饰
- 不要复杂光影背景
- 让人物主体最突出

【严格禁止】
- 禁止普通照片像素化效果
- 禁止模糊缩小感
- 禁止柔和发灰过渡
- 禁止脏色、脏灰、脏绿、脏棕
- 禁止手部真实复杂细节
- 禁止眼部随机杂点
- 禁止花朵内部大量碎点
- 禁止头发内部随机亮点
- 禁止大面积噪点
- 禁止杂乱抗锯齿感
- 禁止看起来像失败的压缩图
- 禁止把已经较好的角色结构改坏
- 禁止为了"锐化"而产生新的脏边
- 禁止加入无关细节
- 禁止改变整体成图方向
- 禁止把图做成另一种风格

【最终质量目标】
最终结果必须是一张：
- 造型接近参考图风格
- 清楚、干净、利落
- 杂色更少
- 眼睛更精致
- 手部更可读
- 花朵更清楚
- 颜色更整洁
- 轮廓更稳定
- 更像专业整理过的拼豆像素大头图
- 比当前版本更精细，但仍保持现有正确方向
- 像"在当前较好版本基础上做精修升级"的结果，而不是另起炉灶

请把人物重新绘制成一张高质量、低杂色、细节更稳、眼手花更清楚、颜色更整洁的 Q版像素大头图。`;
}

// 生成指定模式的 prompt
export function buildPrompt(aiMode: string, targetSize?: number, hasReferenceImage: boolean = false): string {
  // pixelPortrait 需要根据 targetSize 生成不同的 prompt
  if (aiMode === 'pixelPortrait') {
    const size = targetSize || 52;
    console.log('[buildPrompt] pixelPortrait targetSize:', size, 'hasReferenceImage:', hasReferenceImage);
    // 使用 pixelPortrait 专用的强化负向 prompt
    return buildPixelPortraitPrompt(size, hasReferenceImage) + '\n\n【负向要求】\n' + NEGATIVE_PROMPT_PIXEL_PORTRAIT;
  }
  
  return (STYLE_PROMPTS[aiMode] || STYLE_PROMPTS.cartoon) + '\n\n【负向要求】\n' + NEGATIVE_PROMPT;
}

// 获取指定模式的输出尺寸
export function getSizeForAiMode(aiMode: string, targetSize?: number): string {
  // pixelPortrait 模式统一使用正方形
  if (aiMode === 'pixelPortrait') {
    // pixelPortrait 模式使用 2048x2048，支持精细像素画细节
    console.log('[getSizeForAiMode] pixelPortrait 模式，使用 2048x2048 正方形');
    return '2048x2048';
  }
  // pixelDoll 模式也使用正方形
  if (aiMode === 'pixelDoll') {
    return AI_MODE_SIZES.pixelDoll;
  }
  // 其他模式使用各自的尺寸
  return AI_MODE_SIZES[aiMode] || AI_MODE_SIZES.cartoon;
}

// ============================================
// Seedream API 调用
// ============================================

export interface SeedreamResult {
  imageUrl?: string;
  imageDataUrl?: string;
  base64?: string;
}

export interface CallSeedreamParams {
  aiMode: string;
  imageUrl: string;
  referenceImageUrl?: string | null;
  prompt?: string;
  targetSize?: number;
  imageWeight?: number; // 🛡️ 6大风格独立隔离权重
}

/**
 * 调用 Seedream API 生成图片
 */
export async function callSeedreamAPI(params: CallSeedreamParams): Promise<SeedreamResult> {
  const { aiMode, imageUrl, referenceImageUrl, prompt, targetSize, imageWeight } = params;

  // 检查环境变量
  if (!SEEDREAM_API_KEY) {
    throw new Error('缺少 SEEDREAM_API_KEY 环境变量');
  }

  // 是否有风格参考图
  const hasRef = !!referenceImageUrl;

  // 构建图片数组
  const images = [imageUrl];
  if (referenceImageUrl) {
    images.push(referenceImageUrl);
  }

  // 生成 prompt（传入 targetSize 和 hasReferenceImage）
  const finalPrompt = prompt || buildPrompt(aiMode, targetSize, hasRef);
  
  // 获取尺寸
  const size = getSizeForAiMode(aiMode, targetSize);

  console.log('[callSeedreamAPI] ========== 调用 Seedream ==========');
  console.log('[callSeedreamAPI] model:', SEEDREAM_MODEL);
  console.log('[callSeedreamAPI] aiMode:', aiMode);
  console.log('[callSeedreamAPI] targetSize:', targetSize);
  console.log('[callSeedreamAPI] seedream size:', size);
  console.log('[callSeedreamAPI] hasReferenceImage:', hasRef);
  console.log('[callSeedreamAPI] referenceImageUrl:', referenceImageUrl || '无');
  console.log('[callSeedreamAPI] imageCount:', images.length);
  console.log('[callSeedreamAPI] promptLength:', finalPrompt.length);
  console.log('[callSeedreamAPI] ====================================');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    // 构建 Seedream 请求体
    const requestBody: Record<string, any> = {
      model: SEEDREAM_MODEL,
      prompt: finalPrompt,
      image: images.length === 1 ? images[0] : images,
      size,
      response_format: 'b64_json',
      watermark: false
    };

    // 🛡️ 注入当前风格的专属隔离权重
    if (imageWeight !== undefined && images.length > 1) {
      requestBody.image_weight = imageWeight;
      console.log('[callSeedreamAPI] image_weight:', imageWeight, '(from STYLE_WEIGHT_CONFIG)');
    }

    // pixelPortrait 模式特殊参数优化
    if (aiMode === 'pixelPortrait') {
      // 使用强化版负向 prompt
      requestBody.negative_prompt = NEGATIVE_PROMPT_PIXEL_PORTRAIT;
    }

    const response = await fetch(SEEDREAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEEDREAM_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Seedream failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[callSeedreamAPI] 响应状态:', data.code || 'success');

    // 标准化返回结果
    return normalizeSeedreamResult(data);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Seedream 调用超时 (${AI_TIMEOUT_MS / 1000}秒)`);
    }
    throw error;
  }
}

/**
 * 标准化 Seedream 返回结果
 */
function normalizeSeedreamResult(data: any): SeedreamResult {
  // 尝试各种可能的字段
  const base64 =
    data.b64_json ||
    data.data?.[0]?.b64_json ||
    data.data?.b64_json ||
    data.result?.b64_json;

  const imageUrl =
    data.image_url ||
    data.data?.[0]?.url ||
    data.data?.url ||
    data.result?.image_url ||
    data.output?.image_url;

  const imageDataUrl =
    data.image_data_url ||
    data.result?.image_data_url ||
    data.output?.image_data_url;

  if (base64) {
    return {
      base64,
      imageDataUrl: `data:image/png;base64,${base64}`
    };
  }

  if (imageDataUrl) {
    return { imageDataUrl };
  }

  if (imageUrl) {
    return { imageUrl };
  }

  // 如果都没有，抛出错误
  console.error('[normalizeSeedreamResult] 无法解析响应:', JSON.stringify(data).slice(0, 500));
  throw new Error('Seedream 返回结果无法解析');
}

/**
 * 保存生成的图片
 */
export async function saveGeneratedImage(result: SeedreamResult): Promise<{
  imageUrl: string;
  imageDataUrl?: string;
}> {
  const timestamp = Date.now();
  const filename = `ai_${timestamp}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  try {
    if (result.imageDataUrl && result.imageDataUrl.startsWith('data:')) {
      // base64 格式
      const base64Data = result.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await writeFile(filepath, buffer);
      console.log('[saveGeneratedImage] 保存 base64 图片:', filename);
    } else if (result.base64) {
      // 纯 base64
      const buffer = Buffer.from(result.base64, 'base64');
      await writeFile(filepath, buffer);
      console.log('[saveGeneratedImage] 保存纯 base64 图片:', filename);
    } else if (result.imageUrl) {
      // 远程 URL，需要下载
      console.log('[saveGeneratedImage] 下载远程图片:', result.imageUrl);
      const response = await fetch(result.imageUrl);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(filepath, buffer);
      console.log('[saveGeneratedImage] 保存远程图片:', filename);
    } else {
      throw new Error('没有可保存的图片数据');
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
    const imageUrl = `${baseUrl}/outputs/${filename}`;

    return {
      imageUrl,
      imageDataUrl: result.imageDataUrl
    };
  } catch (error) {
    console.error('[saveGeneratedImage] 保存失败:', error);
    throw error;
  }
}
