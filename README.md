# 🤖 Robot Module DataManager

这是一个用于存储和对比常用人形机器人关节模组性能参数的前后端分离系统。
系统具有科技感 UI，并支持 WebSocket 实时多端数据同步。

## 🛠️ 技术栈
- **后端**：Python (FastAPI) + SQLite + WebSockets + JWT
- **前端**：React + Vite + Tailwind CSS + ECharts + Zustand

---

## 🚀 如何启动项目

项目分为前端和后端两部分，需要**分别在两个不同的终端窗口**中启动。

### 1. 启动后端 (FastAPI)

打开一个终端（PowerShell 或 CMD），执行以下命令：

```powershell
# 进入后端目录
cd backend

# 激活虚拟环境
.\venv\Scripts\activate

# 启动 FastAPI 服务
uvicorn app.main:app --reload --port 8000
```
*启动成功后，后端服务将运行在：`http://localhost:8000`*

### 2. 启动前端 (React + Vite)

打开另一个新的终端窗口，执行以下命令：

```powershell
# 进入前端目录
cd frontend

# 启动开发服务器
npm run dev
```
*启动成功后，前端界面将运行在：`http://localhost:5173`*

---

## 👥 测试账号说明

数据库在首次启动时已自动初始化，内置了两个测试账号：

1. **管理员账号**（可进行增删改查）
   - 用户名: `admin`
   - 密码: `adminpassword`

2. **普通用户**（仅能查看数据和图表）
   - 用户名: `user`
   - 密码: `userpassword`

## 💡 注意事项
- 请确保后端的运行端口为 `8000`，前端配置的请求代理地址是硬编码的 `http://localhost:8000/api/v1`。
- 如果需要停止服务，在终端中按下 `Ctrl + C` 即可。
