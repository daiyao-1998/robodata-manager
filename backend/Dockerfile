FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 复制 requirements.txt 到容器中
COPY requirements.txt .

# 使用腾讯云镜像源加速安装依赖
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple

# 复制所有后端代码到容器中
COPY . .

# 暴露端口，云托管通常默认监听 80 端口，这里设置环境变量默认值为 80
ENV PORT=80
EXPOSE 80

# 启动命令
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
