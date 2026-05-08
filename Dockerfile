# =============================================
# 拼豆像素图生成器 - Sealos 部署镜像
# =============================================
# 基础镜像：Node.js 24 + Python 3
FROM node:24-slim

# 安装 Python 3 和 pip（Node.js slim 镜像默认不带 Python）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装拼豆管线所需的 Python 依赖
# 体积预估：scipy~150MB + scikit-learn~100MB + numpy~20MB + pillow~30MB + requests~5MB ≈ 300MB
COPY requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt

# 复制项目文件
WORKDIR /app
COPY . .

# 安装 Node.js 依赖
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 构建 Next.js 生产版本
RUN pnpm run build

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["pnpm", "run", "start"]
