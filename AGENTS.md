# 拼豆像素图生成器 - 项目规范

## 项目概览
- **类型**: Web应用 (Next.js)
- **核心功能**: Seedream 生图 + 风格参考 + 按比例采样 + 拼豆色板映射
- **目标用户**: 拼豆爱好者

## 技术栈
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS

## 核心架构：四段式流程

```
上传图片 → 选择 AI 模式 + 色板预设
         → /api/optimize-image (Seedream + 风格参考图)
         → 读取 AI 图真实尺寸
         → /api/generate-pattern (采样 + 色板限制映射)
         → 展示拼豆图纸
```

### pixelPortrait 模式新特性
- **风格参考图**：默认使用 `/public/reference/pixel-portrait-style.png` 作为风格参考
- **色板预设**：生成前必须选择色板预设，限制最终图纸使用的颜色
- **Prompt 区分**：明确区分 Image A（用户原图=人物特征）和 Image B（风格参考图=画风）

### 第一段：Seedream 生图
- **API**: `/api/optimize-image`
- **模型**: Seedream 5.0 lite (图生图)
- **尺寸**：
  - pixelFullBody: 1920x2880 (2:3 竖版)
  - pixelPortrait: 2048x2048 (正方形)
  - pixelDoll: 2048x2048 (正方形)
  - cartoon: 1920x2400 (4:5 竖版)
- **风格参考图（仅 pixelPortrait）**：
  - 后端自动注入默认参考图：`PUBLIC_BASE_URL + /reference/pixel-portrait-style.png`
  - 参考图只控制风格（粗黑轮廓、Q版像素小人、大头小身、硬边色块）
  - 人物身份特征仍来自用户原图
- **Prompt 系统**：
  - pixelPortrait + 参考图：区分 Image A（人物）和 Image B（风格）
  - pixelPortrait 无参考图：fallback prompt
  - 负向 prompt：realistic portrait, semi-realistic, smooth gradient, watercolor 等
- **目标**: 生成适合像素化的人像插画底稿

### 第二段：读取 AI 图尺寸
- **前端自动执行**：读取 AI 图的 naturalWidth/naturalHeight
- **尺寸计算**：
  - pixelPortrait/pixelDoll 模式：强制正方形，targetWidth=targetHeight=maxSide
  - pixelFullBody/cartoon 模式：按比例计算

### 第三段：拼豆采样映射
- **API**: `/api/generate-pattern`
- **色板限制**：pixelPortrait 模式传入 paletteId，限制映射使用的颜色范围
- **处理流程**：
  1. 下载 AI 优化图
  2. K-means 限色（根据 aiMode + targetSize 自适应）
  3. NEAREST 采样到目标尺寸
  4. 色板限制映射（如果传了 paletteId，只使用该色板的颜色）
  5. 生成预览图
  6. 返回统计信息

### 第四段：展示图纸
- 前端展示预览图、尺寸、颜色统计
- 支持下载图纸

## 色板中心组件

### 组件路径
`src/components/PaletteCenter.tsx`

### 功能特性
1. **色号系统切换**：MARD / COCO / 漫漫 / 盼盼 / 咪小窝
2. **预设色板选择**：仅 MARD 显示 291色 / 221色 / 144色 / 120色
3. **默认选择**：默认选择 MARD 221 色预设
4. **全选/全不选**：批量操作
5. **搜索功能**：按色号搜索
6. **引导提示**：蓝色提示框说明操作流程
7. **色号标签**：横向排列的标签卡片，格式为"A 26"（带空格）

### 颜色排列
- 按字母前缀分组
- 组内按数字升序排列
- 格式：`<字母> <数字>` 如 "A 26"、"B 32"、"ZG 8"

## 五品牌拼豆颜色系统

### 架构概述

新系统基于 `src/data/colorSystemMapping.json` 提供统一的五品牌颜色管理：

```
src/data/colorSystemMapping.json  ←  公开数据源
    ↓
src/lib/color-systems.ts          ←  解析和管理颜色数据
    ↓
src/app/api/generate-pattern/    ←  根据 brand 执行真实取色
```

### 品牌数据结构

每条颜色记录包含：
- `hex`: 十六进制颜色值
- `rgb`: [R, G, B] 数组
- `codes.MARD`: MARD 色号（如 A01, A02...）
- `codes.COCO`: COCO 色号
- `codes.漫漫`: 漫漫 色号
- `codes.盼盼`: 盼盼 色号
- `codes.咪小窝`: 咪小窝 色号

### 取色逻辑

**核心原则**：用户选择哪个品牌，就用哪个品牌的色号体系取色。

```
brand = "MARD"  →  allowedColors = 所有有 MARD 色号的颜色
brand = "COCO"  →  allowedColors = 所有有 COCO 色号的颜色
brand = "漫漫"  →  allowedColors = 所有有 漫漫 色号的颜色
brand = "盼盼"  →  allowedColors = 所有有 盼盼 色号的颜色
brand = "咪小窝" →  allowedColors = 所有有 咪小窝 色号的颜色
```

nearestColor 只在 allowedColors 中匹配。

### 预设色板

| 品牌 | 预设选项 |
|------|---------|
| MARD | 全部 / 291色 / 221色 / 144色 / 120色 |
| COCO | 全部 |
| 漫漫 | 全部 |
| 盼盼 | 全部 |
| 咪小窝 | 全部 |

### API 请求格式

```json
{
  "paletteId": "291",
  "brand": "咪小窝",
  "targetWidth": 52,
  "targetHeight": 52
}
```

### API 返回格式

```json
{
  "success": true,
  "actualWidth": 52,
  "actualHeight": 52,
  "totalBeads": 2704,
  "colorCount": 15,
  "previewUrl": "...",
  "paletteId": "291",
  "brand": "咪小窝",
  "displayMode": "咪小窝 真实取色",
  "stats": [
    {
      "masterCode": "A02",
      "displayCode": "131",
      "brand": "咪小窝",
      "hex": "#FFFFFF",
      "rgb": [255, 255, 255],
      "count": 1235
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| masterCode | MARD 色号（原始色号） |
| displayCode | 当前品牌色号（显示用） |
| hex | 十六进制颜色值 |
| rgb | RGB 数组 |
| count | 该颜色使用的颗粒数 |

### 色板中心组件

- **MARD**：显示预设选择（全部/291/221/144/120）
- **其他品牌**：只显示全部颜色
- 默认选择：MARD 全部

## 环境变量配置

```bash
# AI Provider
AI_PROVIDER=seedream

# Seedream API 配置
SEEDREAM_API_KEY=你的Seedream_API_KEY
SEEDREAM_API_URL=https://ark.cn-beijing.volces.com/api/v3/images/generations
SEEDREAM_MODEL=doubao-seedream-5-0-260128

# AI 调用超时
AI_TIMEOUT_MS=180000

# 公共 URL（用于拼接默认参考图URL）
PUBLIC_BASE_URL=https://你的域名
```

## AI 模式与尺寸

| aiMode | Seedream尺寸 | 图纸尺寸 | 风格参考图 | 色板选择 | 说明 |
|--------|-------------|----------|-----------|---------|------|
| pixelFullBody | 1920x2880 | 按比例 | 否 | 否 | 2:3 竖版，适合全身 |
| pixelPortrait | 2048x2048 | maxSide×maxSide | 是（自动注入） | 是（必须选择） | 正方形，适合大头 |
| pixelDoll | 2048x2048 | maxSide×maxSide | 否 | 否 | 正方形，适合Q版豆灵 |
| cartoon | 1920x2400 | 按比例 | 否 | 否 | 4:5 竖版，适合卡通 |

### 模式区分逻辑

**比例自适应模式（pixelFullBody/cartoon）**：
- 滑杆控制 maxSide
- 图纸尺寸按 AI 图真实比例计算

**正方形模式（pixelPortrait/pixelDoll）**：
- 图纸尺寸固定 maxSide×maxSide
- pixelPortrait：自动注入风格参考图 + 必须选择色板

**注意**：Seedream API 要求图片尺寸至少 3686400 像素。

## API 接口定义

### /api/temp-image
POST multipart/form-data
- image: File
返回: `{ success, imageUrl }`

### /api/optimize-image
POST application/json
```json
{
  "aiMode": "pixelPortrait",
  "imageUrl": "公网URL",
  "referenceImageUrl": null,
  "targetWidth": 52,
  "targetHeight": 52,
  "targetSize": 52
}
```
- pixelPortrait 模式：referenceImageUrl 为 null 时后端自动注入默认参考图
- 返回: `{ success, provider, mode, inputImageUrl, outputImageUrl, referenceImageUrl, debug }`

### /api/generate-pattern
POST application/json
```json
{
  "optimizedImageUrl": "AI优化图URL",
  "targetWidth": 52,
  "targetHeight": 52,
  "colorMode": "detail",
  "aiMode": "pixelPortrait",
  "paletteId": "221",
  "brand": "MARD"
}
```
- **paletteId**: 色板预设（仅 MARD 有预设：291/221/144/120）
- **brand**: 显示品牌（MARD/COCO/漫漫/盼盼/咪小窝）
- 返回: `{ success, previewUrl, actualWidth, actualHeight, totalBeads, colorCount, paletteId, brand, displayMode, stats }`
  - **displayMode**: 'MARD 真实取色' 或 '按 MARD 等效色显示 XX 色号'
  - **stats[].isEquivalent**: true 表示等效色号

### /api/palettes
GET
返回: `{ success, referenceImagePath, presets: [{ id, name, description, codes, rgbMap, colorCount }] }`

## 目录结构
```
src/
├── app/
│   ├── api/
│   │   ├── temp-image/route.ts          # 临时图片上传
│   │   ├── optimize-image/route.ts       # 第一段：Seedream 生图（含参考图注入）
│   │   ├── generate-pattern/route.ts    # 第三段：采样 + 五品牌颜色映射
│   │   └── palettes/route.ts            # 色板预设查询
│   ├── colorSystemMapping.json          # 多品牌色号映射表（公开数据源）
│   └── ai-pixels/page.tsx               # 前端页面
├── data/
│   └── colorSystemMapping.json          # 五品牌颜色数据（已导入）
├── lib/
│   ├── seedream.ts                      # Seedream API + Prompt + 色板预设
│   ├── color-systems.ts                 # 五品牌颜色系统（新增）
│   ├── color-palettes.ts                # MARD_221_COLORS 和 CSV_MARD_COLORS 定义
│   └── color-code-map.ts                # CSV 色号数据处理
└── components/                           # UI组件
public/
└── reference/
    └── pixel-portrait-style.png         # pixelPortrait 默认风格参考图
```

## 限色策略（自适应）

### pixelPortrait 模式
| targetSize | detail 模式 | simple 模式 |
|-----------|------------|------------|
| ≤56 | 16 色 | 12 色 |
| ≤72 | 20 色 | 16 色 |
| >72 | 24 色 | 20 色 |

### 其他模式
- 默认 24 色（detail）/ 16 色（simple）

## Python 依赖要求

```bash
pip3 install numpy pillow requests scipy scikit-learn
```

## 移动端适配

### 画布编辑器
- **双指缩放**：通过 CSS transform: scale() 实现，支持 30%~300% 缩放
- **双指平移**：缩放时同时支持双指移动画布
- **单指拖拽**：需开启"拖拽"模式后才能单指移动
- **画布尺寸响应式**：
  - 手机端：280px
  - 平板：400px
  - 电脑端：520px

### 拼豆图纸预览
- **主视觉区高度响应式**：300px (手机) / 450px (电脑)
- **指标卡片**：4列 → 2列布局适配
- **颜色统计**：max-height 缩小适配
- **模式切换卡片**：尺寸和间距响应式调整

### 色板中心组件
- **弹窗位置**：手机端底部弹出 (items-end)，电脑端居中
- **弹窗高度**：手机端 60vh，电脑端 auto
- **各区域间距**：padding 和 font-size 响应式缩小
- **颜色网格**：手机端 3 列，电脑端 4+ 列

## 验收标准

1. **风格参考图生效**：pixelPortrait 模式自动注入参考图，AI 图风格接近参考图
2. **色板限制生效**：选择不同色板，最终图纸使用不同颜色范围
3. **色板必须选择**：pixelPortrait 模式下，未选择色板时按钮禁用
4. **尺寸比例正确**：AI 图如果是 2048x3072，maxSide=50，目标尺寸必须是 33x50
5. **正方形模式正确**：pixelPortrait maxSide=52 → 52×52
6. **参考图不影响其他模式**：pixelFullBody/cartoon/pixelDoll 不注入参考图
7. **人物特征保留**：AI 图保留用户原图的发型、服装、姿势

## 常见问题

### Q: 生成时间长
A: Seedream 5.0 lite 图生图需要15-25秒，前端已设置超时。

### Q: 图片模糊
A: 确保 Seedream 生成了高清底稿，采样使用 NEAREST 抗锯齿。

### Q: 第一段失败
A: 检查 SEEDREAM_API_KEY 和 SEEDREAM_API_URL 环境变量是否配置正确。

### Q: Seedream 429 错误
A: 账户额度用完（SetLimitExceeded），需要在火山引擎控制台调整。

### Q: Python 处理超时
A: 
1. 确保 Python 依赖已安装：`pip3 install scipy scikit-learn`
2. 检查 `PUBLIC_BASE_URL` 环境变量是否配置正确
3. 图片下载超时已设置为 120 秒

### Q: 色板选择后颜色仍不对
A: 检查 paletteId 是否正确传入 generate-pattern，查看日志确认使用了正确的色板。
