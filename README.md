# Robot Module DataManager

人形机器人关节模组性能参数管理与对比系统，提供数据表格、图表分析、三维模型预览与测量等功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python · FastAPI · SQLite · WebSockets · JWT |
| 前端 | React 19 · Vite 8 · Tailwind CSS 4 · ECharts 6 · Three.js 0.184 (`@react-three/fiber` 9 · `@react-three/drei` 10) · Zustand 5 |

## 功能概览

- **模组数据库**：展示各厂商关节模组参数（扭矩、扭矩密度等），傅利叶产品红色标注
- **图表分析**：散点图 / 柱状图多维对比，支持缩放与标签避让
- **三维模型预览**：GLB 格式模型加载（详见下节）
- **拆解报告预览**：从 `data.json` 的 `report_pdf` 字段动态加载，在 3D 查看器内 iframe 全屏显示
- **用户管理**（管理员）：增删改查账号与权限
- **WebSocket 实时同步**：多端数据实时更新

## 三维模型查看器

### 模型交互

- **模型结构树**：按层级显示零件，可展开/折叠，支持逐个显示或隐藏
- **高亮与孤立**：点击结构树节点高亮选中零件（支持 Ctrl/Cmd 多选）；右键可孤立显示，其余零件降至 15% 透明度
- **黑色线框轮廓**：EdgesGeometry 异步分批构建（每帧 10 个 Mesh），不阻塞首帧加载
- **剖切面**：X / Y / Z 轴独立滑块切割，使用 Stencil Z-Pass 算法生成封盖，旋转时无闪烁
- **视角快捷切换**：正 / 后 / 左 / 右 / 俯 / 仰 6 个快捷视角

### 测量工具

| 工具 | 说明 |
|---|---|
| 点点距离 | 两点之间直线距离（mm） |
| 点面距离 | 点到平面的垂直距离，显示投影点 |
| 面面距离 | 两平行平面间距离（自动验证平行性） |
| 圆弧半径 | Kasa 最小二乘 3D 圆拟合，支持不封闭弧 |

点击模型表面即可选取要素；圆弧测量自动沿边缘线追踪连续曲线（O(n) 端点哈希）。

## 数据源与字段说明

### 数据源

- 模组数据：`frontend/public/data.json`
- 用户账号：SQLite（`backend/data.db`）

### 模组数据字段

| 分类 | 字段名 | 单位 |
|---|---|---|
| 基本信息 | `name` / `manufacturer` / `description` | — |
| 扭矩 | `peak_torque` / `nominal_torque` / `start_stop_torque` / `stall_torque` | Nm |
| 转速 | `peak_speed` / `nominal_speed` | rpm |
| 扭矩密度 | `peak_torque_density` / `nominal_torque_density` | Nm/kg |
| 动态性能 | `response_time` / `speed_fluctuation` / `torque_fluctuation` | ms / % / % |
| 过载耐久 | `overload_time_1_5x` / `overload_time_2x` / `overload_time_2_5x` / `overload_time_3x` | s |
| 物理参数 | `weight` / `reduction_ratio` / `voltage` | kg / — / V |
| 尺寸 | `actuator_outer_diameter` / `actuator_hollow_diameter` / `actuator_axial_length` | mm |
| 电机尺寸 | `stator_inner_diameter` / `stator_outer_diameter` / `rotor_inner_diameter` / `rotor_outer_diameter` | mm |
| **资源文件** | `model_3d` | GLB 文件名（放于 `frontend/public/`） |
| **资源文件** | `report_pdf` | PDF 文件名（放于 `frontend/public/`，可为空） |

### 资源文件放置规则

```
frontend/public/
├── <模型文件>.glb        # 3D 模型，data.json 中 model_3d 填文件名
└── <报告文件>.pdf        # 拆解报告，data.json 中 report_pdf 填文件名
```

`report_pdf` 字段为空时，3D 查看器中不显示报告预览按钮。

## 启动方法

需要**两个终端**分别启动前后端。

### 后端

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

后端运行在 `http://localhost:8000`

### 前端

```powershell
cd frontend
npm run dev
```

前端运行在 `http://localhost:5173`

## 测试账号

| 角色 | 用户名 | 密码 | 权限 |
|---|---|---|---|
| 管理员 | `admin` | `adminpassword` | 增删改查 + 用户管理 |
| 普通用户 | `user` | `userpassword` | 只读查看 |

## 注意事项

- 前端代理硬编码指向 `http://localhost:8000/api/v1`，后端端口必须为 `8000`
- 3D 模型和 PDF 报告均放在 `frontend/public/` 目录，在 `data.json` 中填写文件名即可加载
- `report_pdf` 字段可留空，不影响 3D 模型预览功能
