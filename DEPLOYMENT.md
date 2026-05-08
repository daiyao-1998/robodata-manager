# 项目部署指南 (Serverless 方案)

本指南将指导您如何将项目免费、快速地部署到公网。
我们推荐的方案是：
- **后端 (FastAPI + SQLite)** 部署在 [Render](https://render.com/)
- **前端 (React)** 部署在 [Vercel](https://vercel.com/)

## 准备工作
1. 注册一个 [GitHub](https://github.com/) 账号（如果还没有）。
2. 在您的本地电脑上，将当前项目 `e:\DataManager` 作为一个代码仓库（Repository）推送到 GitHub。
   > 确保您的代码库包含根目录下的 `backend` 和 `frontend` 文件夹。

---

## 步骤一：部署后端 (Render)

Render 提供了免费的 Web Service，非常适合托管 Python FastAPI。

1. 登录 [Render](https://dashboard.render.com/)。
2. 点击右上角 **New**，选择 **Web Service**。
3. 绑定您的 GitHub 账号，并选择您刚才推送的项目仓库。
4. 在服务配置页面，按以下信息填写：
   - **Name**: `robodata-backend` (可自定义)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: 留空（Render 会自动读取我们在 `backend` 目录下创建的 `Procfile`）
   - **Instance Type**: 免费版 (Free)
5. 点击 **Create Web Service**。
6. 稍等片刻，Render 会分配给您一个公网域名（例如 `https://robodata-backend.onrender.com`）。
   > **请将这个域名复制下来，部署前端时会用到！**

---

## 步骤二：部署前端 (Vercel)

Vercel 是目前托管 React 前端最快、体验最好的平台。

1. 登录 [Vercel](https://vercel.com/)，推荐使用 GitHub 账号直接登录。
2. 点击右上角 **Add New...**，选择 **Project**。
3. 在 Import Git Repository 列表中，找到并 **Import** 您的项目仓库。
4. 在配置页面中：
   - **Project Name**: `robodata-frontend` (可自定义)
   - **Framework Preset**: 会自动识别为 `Vite`。
   - **Root Directory**: 点击右侧的 `Edit`，选择 `frontend` 文件夹。
5. **展开 Environment Variables（环境变量）选项卡**，添加一项：
   - **Name**: `VITE_API_URL`
   - **Value**: 填写您在步骤一中得到的后端地址（例如 `https://robodata-backend.onrender.com`）。
6. 点击 **Deploy** 开始部署。
7. 部署完成后，Vercel 也会给您分配一个公网域名，任何人都可以通过这个域名访问您的系统了！

---

## 💡 注意事项与常见问题

- **数据库持久化**：由于我们使用的是 SQLite 文件型数据库，在 Render 的免费版中，每次重新部署（或长时间不活动重启后），容器会被重置，导致 `sql_app.db` 文件丢失（数据被初始化）。如果您需要长期保存数据，建议在 Render 中配置 **Disk (挂载磁盘)**，或将数据库替换为云端的 PostgreSQL / MySQL。
- **冷启动延迟**：Render 的免费服务如果在 15 分钟内没有被访问，会自动休眠。下一次有人访问时会经历大约 30 秒的“冷启动”唤醒时间，这是正常现象。
- **跨域问题 (CORS)**：后端代码中目前配置的 CORS 是 `allow_origins=["*"]`（允许所有域名），这确保了无论您的前端部署在哪里，都能成功请求到后端接口。
