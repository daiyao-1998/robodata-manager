import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Bounds, useBounds, Html, useProgress, GizmoHelper, GizmoViewport, Line } from '@react-three/drei';
import * as THREE from 'three';
import { EyeIcon, EyeSlashIcon, CubeIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type MeasureMode = 'none' | 'p2p' | 'p2plane' | 'plane2plane' | 'arc';
export type PickedData = { point: THREE.Vector3; normal: THREE.Vector3 };
export type Measurement = {
  id: string;
  type: MeasureMode;
  value: number;
  linePoints: THREE.Vector3[];
  labelPosition: THREE.Vector3;
  curvePoints?: THREE.Vector3[];
};

// 法向量转换工具
const getWorldNormal = (object: THREE.Object3D, faceNormal: THREE.Vector3) => {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
  return faceNormal.clone().applyMatrix3(normalMatrix).normalize();
};

// 三点定圆算法（保留用于初步检查）
function calculateCircle(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
  const v1 = new THREE.Vector3().subVectors(p2, p1);
  const v2 = new THREE.Vector3().subVectors(p3, p1);

  const normal = new THREE.Vector3().crossVectors(v1, v2);
  if (normal.lengthSq() < 1e-8) return null; // 三点共线

  const dot1 = v1.lengthSq();
  const dot2 = v2.lengthSq();

  const cross1 = new THREE.Vector3().crossVectors(v1, normal).multiplyScalar(dot2);
  const cross2 = new THREE.Vector3().crossVectors(v2, normal).multiplyScalar(dot1);

  const centerOffset = new THREE.Vector3().subVectors(cross2, cross1).divideScalar(2 * normal.lengthSq());
  const center = new THREE.Vector3().addVectors(p1, centerOffset);
  const radius = center.distanceTo(p1);

  return { center, radius, normal: normal.normalize() };
}

// 最小二乘 3D 圆拟合：对部分圆弧（不封闭）也能稳定求出圆心和半径
function fitCircle3D(points: THREE.Vector3[]) {
  const n = points.length;
  if (n < 3) return null;

  // 1. 从均匀分布的三元组中找到第一组不共线的点，计算法向量
  let normal: THREE.Vector3 | null = null;
  const stride = Math.max(1, Math.floor(n / 8));
  outer: for (let a = 0; a < n; a += stride) {
    for (let b = a + stride; b < n; b += stride) {
      for (let c = b + stride; c < n; c += stride) {
        const v1 = new THREE.Vector3().subVectors(points[b], points[a]);
        const v2 = new THREE.Vector3().subVectors(points[c], points[a]);
        const cand = new THREE.Vector3().crossVectors(v1, v2);
        if (cand.lengthSq() > 1e-16) { normal = cand.normalize(); break outer; }
      }
    }
  }
  // 上面未找到时，暴力扫描任意三点
  if (!normal) {
    for (let a = 0; a < n && !normal; a++) {
      for (let b = a + 1; b < n && !normal; b++) {
        for (let c = b + 1; c < n; c++) {
          const v1 = new THREE.Vector3().subVectors(points[b], points[a]);
          const v2 = new THREE.Vector3().subVectors(points[c], points[a]);
          const cand = new THREE.Vector3().crossVectors(v1, v2);
          if (cand.lengthSq() > 1e-16) { normal = cand.normalize(); break; }
        }
      }
    }
  }
  if (!normal) return null;

  // 2. 在拟合平面上建立正交基 (u, v)
  const u = new THREE.Vector3();
  if (Math.abs(normal.x) < 0.9) u.set(1, 0, 0); else u.set(0, 1, 0);
  u.sub(normal.clone().multiplyScalar(u.dot(normal))).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u);

  // 3. 计算质心
  const centroid = new THREE.Vector3();
  for (let i = 0; i < n; i++) centroid.add(points[i]);
  centroid.divideScalar(n);

  // 4. Kasa 最小二乘拟合
  let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, Sxz = 0, Syz = 0, Sz = 0;
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3().subVectors(points[i], centroid);
    const x = d.dot(u), y = d.dot(v);
    const z = x * x + y * y;
    Sxx += x * x; Sxy += x * y; Syy += y * y;
    Sx += x; Sy += y;
    Sxz += x * z; Syz += y * z; Sz += z;
  }

  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]];
  const rhs = [Sxz, Syz, Sz];
  const D = det3(M);
  if (Math.abs(D) < 1e-16) return null;
  const replaceCol = (col: number) =>
    M.map((row, i) => row.map((val, j) => (j === col ? rhs[i] : val)));
  const A = det3(replaceCol(0)) / D;
  const B = det3(replaceCol(1)) / D;
  const C = det3(replaceCol(2)) / D;

  const cx = A / 2, cy = B / 2;
  const r2 = C + cx * cx + cy * cy;
  if (!isFinite(r2) || r2 <= 0) return null;

  const center = centroid.clone()
    .add(u.clone().multiplyScalar(cx))
    .add(v.clone().multiplyScalar(cy));

  return { center, radius: Math.sqrt(r2), normal };
}

// 提取模型上连续边缘曲线的算法（基于端点哈希的 O(n) 实现）
function extractArcFromMesh(mesh: THREE.Object3D, worldHitPoint: THREE.Vector3) {
  let edgeChild = mesh.children.find(c => c.userData.isEdge) as THREE.LineSegments;

  // 边缘线条可能尚未被异步批处理建好，此时为当前 mesh 按需同步构建
  if (!edgeChild) {
    const meshObj = mesh as THREE.Mesh;
    if (!meshObj.geometry) return null;
    const edgesGeom = new THREE.EdgesGeometry(meshObj.geometry, 15);
    const ls = new THREE.LineSegments(edgesGeom, new THREE.LineBasicMaterial({ color: 0x000000 }));
    ls.userData.isEdge = true;
    mesh.add(ls);
    edgeChild = ls;
    // 标记已建，防止异步批处理重复创建
    meshObj.userData.hasEdges = true;
  }

  if (!edgeChild.geometry) return null;

  const positions = edgeChild.geometry.attributes.position.array as ArrayLike<number>;
  const numPoints = positions.length / 3;
  if (numPoints < 2) return null;
  const segCount = numPoints / 2;

  const localP = mesh.worldToLocal(worldHitPoint.clone());
  const lpx = localP.x, lpy = localP.y, lpz = localP.z;

  // 将顶点量化为字符串 key，构建 "顶点 → 关联线段索引列表" 的哈希表
  // 量化精度通过模型尺寸自适应（避免浮点漂移导致同顶点 key 不一致）
  const bbox = edgeChild.geometry.boundingBox || (edgeChild.geometry.computeBoundingBox(), edgeChild.geometry.boundingBox!);
  const diag = bbox ? Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z) : 1;
  const quantStep = Math.max(diag * 1e-5, 1e-6);
  const invStep = 1 / quantStep;
  const keyOf = (x: number, y: number, z: number) =>
    `${Math.round(x * invStep)}_${Math.round(y * invStep)}_${Math.round(z * invStep)}`;

  // 平铺存储所有线段端点坐标，避免创建 Vector3 对象
  const aX = new Float32Array(segCount), aY = new Float32Array(segCount), aZ = new Float32Array(segCount);
  const bX = new Float32Array(segCount), bY = new Float32Array(segCount), bZ = new Float32Array(segCount);
  const keyA: string[] = new Array(segCount);
  const keyB: string[] = new Array(segCount);
  const used = new Uint8Array(segCount);
  const endpointMap = new Map<string, number[]>();

  let minDistSq = Infinity;
  let bestIndex = -1;

  for (let i = 0; i < segCount; i++) {
    const ax = positions[i * 6], ay = positions[i * 6 + 1], az = positions[i * 6 + 2];
    const bx = positions[i * 6 + 3], by = positions[i * 6 + 4], bz = positions[i * 6 + 5];
    aX[i] = ax; aY[i] = ay; aZ[i] = az;
    bX[i] = bx; bY[i] = by; bZ[i] = bz;
    const ka = keyOf(ax, ay, az);
    const kb = keyOf(bx, by, bz);
    keyA[i] = ka;
    keyB[i] = kb;
    let listA = endpointMap.get(ka);
    if (!listA) { listA = []; endpointMap.set(ka, listA); }
    listA.push(i);
    let listB = endpointMap.get(kb);
    if (!listB) { listB = []; endpointMap.set(kb, listB); }
    listB.push(i);

    // 点到线段的最短平方距离（内联，无对象分配）
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const l2 = dx * dx + dy * dy + dz * dz;
    let distSq: number;
    if (l2 === 0) {
      const ex = lpx - ax, ey = lpy - ay, ez = lpz - az;
      distSq = ex * ex + ey * ey + ez * ez;
    } else {
      let t = ((lpx - ax) * dx + (lpy - ay) * dy + (lpz - az) * dz) / l2;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const px = ax + t * dx, py = ay + t * dy, pz = az + t * dz;
      const ex = lpx - px, ey = lpy - py, ez = lpz - pz;
      distSq = ex * ex + ey * ey + ez * ez;
    }
    if (distSq < minDistSq) {
      minDistSq = distSq;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) return null;

  used[bestIndex] = 1;
  const chain: THREE.Vector3[] = [
    new THREE.Vector3(aX[bestIndex], aY[bestIndex], aZ[bestIndex]),
    new THREE.Vector3(bX[bestIndex], bY[bestIndex], bZ[bestIndex]),
  ];

  // 沿一个方向追踪邻接线段，用端点哈希做 O(1) 查找
  const MAX_ANGLE = Math.PI / 3;
  const traceFrom = (startIdx: number, startFromB: boolean, push: (v: THREE.Vector3) => void) => {
    let curX: number, curY: number, curZ: number, curKey: string;
    let prevDx: number, prevDy: number, prevDz: number;
    if (startFromB) {
      curX = bX[startIdx]; curY = bY[startIdx]; curZ = bZ[startIdx]; curKey = keyB[startIdx];
      prevDx = bX[startIdx] - aX[startIdx]; prevDy = bY[startIdx] - aY[startIdx]; prevDz = bZ[startIdx] - aZ[startIdx];
    } else {
      curX = aX[startIdx]; curY = aY[startIdx]; curZ = aZ[startIdx]; curKey = keyA[startIdx];
      prevDx = aX[startIdx] - bX[startIdx]; prevDy = aY[startIdx] - bY[startIdx]; prevDz = aZ[startIdx] - bZ[startIdx];
    }
    let prevLen = Math.hypot(prevDx, prevDy, prevDz) || 1;
    prevDx /= prevLen; prevDy /= prevLen; prevDz /= prevLen;

    for (let step = 0; step < 500; step++) {
      const list = endpointMap.get(curKey);
      if (!list) break;
      let found = false;
      for (let k = 0; k < list.length; k++) {
        const idx = list[k];
        if (used[idx]) continue;
        let nx: number, ny: number, nz: number, nKey: string;
        if (keyA[idx] === curKey) {
          nx = bX[idx]; ny = bY[idx]; nz = bZ[idx]; nKey = keyB[idx];
        } else if (keyB[idx] === curKey) {
          nx = aX[idx]; ny = aY[idx]; nz = aZ[idx]; nKey = keyA[idx];
        } else {
          continue;
        }
        const dx = nx - curX, dy = ny - curY, dz = nz - curZ;
        const len = Math.hypot(dx, dy, dz);
        if (len === 0) continue;
        const ndx = dx / len, ndy = dy / len, ndz = dz / len;
        let dot = prevDx * ndx + prevDy * ndy + prevDz * ndz;
        if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
        const angle = Math.acos(dot);
        if (angle < MAX_ANGLE) {
          used[idx] = 1;
          push(new THREE.Vector3(nx, ny, nz));
          curX = nx; curY = ny; curZ = nz; curKey = nKey;
          prevDx = ndx; prevDy = ndy; prevDz = ndz;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
  };

  traceFrom(bestIndex, true, (v) => chain.push(v));
  traceFrom(bestIndex, false, (v) => chain.unshift(v));

  if (chain.length < 3) return null;
  return chain.map(pt => mesh.localToWorld(pt));
}

// 递归树节点组件
const TreeNode = ({ node, onToggle, onHighlight, highlightedIds, onContextMenu }: { node: any, onToggle: (ref: any, visible: boolean) => void, onHighlight: (id: string, multi: boolean) => void, highlightedIds: string[], onContextMenu: (e: any, id: string) => void }) => {
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(node.visible);

  // 同步外部的可见性（防初始化不同步）
  useEffect(() => {
    setVisible(node.visible);
  }, [node.visible]);

  // 如果是根节点 Scene，直接渲染子节点
  if (node.name === 'Scene' || node.name === 'OSG_Scene') {
    return (
      <>
        {node.children.map((c: any) => (
          <TreeNode key={c.id} node={c} onToggle={onToggle} onHighlight={onHighlight} highlightedIds={highlightedIds} onContextMenu={onContextMenu} />
        ))}
      </>
    );
  }

  const handleToggle = () => {
    const newVis = !visible;
    setVisible(newVis);
    onToggle(node.ref, newVis);
  };

  const hasChildren = node.children && node.children.length > 0;
  const isHighlighted = highlightedIds.includes(node.id);

  return (
    <div className="pl-3">
      <div 
        className={`flex items-center gap-2 py-1 px-1 text-sm rounded transition-colors ${isHighlighted ? 'bg-blue-900/30' : 'hover:bg-dark-600/50'}`}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, node.id);
        }}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
          className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white"
        >
          {hasChildren ? (expanded ? '▾' : '▸') : <CubeIcon className="w-3 h-3 opacity-50" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleToggle(); }} className={`${visible ? 'text-blue-400' : 'text-slate-600'} hover:text-blue-300 transition-colors`}>
          {visible ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
        </button>
        <span 
          className={`truncate select-none cursor-pointer transition-colors ${isHighlighted ? 'text-blue-400 font-medium' : 'text-slate-300 hover:text-blue-300'}`} 
          title={node.name}
          onClick={(e) => { e.stopPropagation(); onHighlight(node.id, e.ctrlKey || e.metaKey); }}
        >
          {node.name || 'Unnamed'}
        </span>
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-dark-600 ml-2">
          {node.children.map((c: any) => (
            <TreeNode key={c.id} node={c} onToggle={onToggle} onHighlight={onHighlight} highlightedIds={highlightedIds} onContextMenu={onContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
};

// 渲染器设置（开启剖切支持和加载状态）

function Loader() {
  const { progress } = useProgress();
  return <Html center><div className="text-white font-mono text-lg">{progress.toFixed(0)} % loaded</div></Html>;
}

const RendererSettings = () => {
  const { gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = true;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);
  return null;
};

// 预定义的高对比度调色板，用于区分不同的零件组
const PALETTE = [
  0x4E79A7, 0xF28E2B, 0xE15759, 0x76B7B2, 0x59A14F, 
  0xEDC948, 0xB07AA1, 0xFF9DA7, 0x9C755F, 0xBAB0AC,
  0x8DD3C7, 0xFFFFB3, 0xBEBADA, 0xFB8072, 0x80B1D3,
  0xFDB462, 0xB3DE69, 0xFCCDE5, 0xD9D9D9, 0xBC80BD
];

// 测量渲染组件
const MeasureOverlays = ({ measurements, currentPicks, modelBounds }: { measurements: Measurement[], currentPicks: PickedData[], modelBounds: THREE.Box3 | null }) => {
  // 根据模型边界动态计算一个合适的点半径
  const pointRadius = useMemo(() => {
    if (!modelBounds) return 0.5; // 默认值
    const size = new THREE.Vector3();
    modelBounds.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    // 假设一个合适的点大小是模型最大尺寸的 0.3%
    return maxDim * 0.003;
  }, [modelBounds]);

  return (
    <group>
      {/* 渲染当前正在点击的过程点（红点提示） */}
      {currentPicks.map((p, i) => (
        <mesh key={i} position={p.point}>
          <sphereGeometry args={[pointRadius, 8, 8]} />
          <meshBasicMaterial color="red" depthTest={false} />
        </mesh>
      ))}

      {/* 渲染已完成的测量结果 */}
      {measurements.map((m) => (
        <group key={m.id}>
          {m.linePoints.length >= 2 && (
            <Line points={m.linePoints} color="yellow" lineWidth={2} depthTest={false} />
          )}
          {/* 渲染提取出的圆弧曲线（青色） */}
          {m.curvePoints && m.curvePoints.length >= 2 && (
            <Line points={m.curvePoints} color="#00ffff" lineWidth={3} depthTest={false} />
          )}
          {/* 在已完成的测量点上也加上小的黄色节点作为端点提示 */}
          {m.linePoints.map((pt, idx) => (
            <mesh key={idx} position={pt}>
              <sphereGeometry args={[pointRadius * 0.8, 8, 8]} />
              <meshBasicMaterial color="yellow" depthTest={false} />
            </mesh>
          ))}
          <Html position={m.labelPosition} center style={{ pointerEvents: 'none', zIndex: 1000 }}>
            <div className="bg-dark-800/90 text-white px-2 py-1 rounded text-xs border border-yellow-500 whitespace-nowrap shadow-lg">
              {m.type === 'arc' ? `R: ${m.value.toFixed(2)} mm` : `D: ${m.value.toFixed(2)} mm`}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// 视角控制器组件
const ViewportController = ({ viewTrigger }: { viewTrigger: { axis: [number, number, number], time: number } | null }) => {
  const bounds = useBounds();
  const { camera } = useThree();
  
  useEffect(() => {
    if (!viewTrigger) return;
    const [x, y, z] = viewTrigger.axis;
    camera.position.set(x * 1000, y * 1000, z * 1000);
    bounds.refresh().fit();
  }, [viewTrigger, bounds, camera]);

  return null;
};

// 场景模型加载组件
const ModelScene = ({ 
  url, clipAxis, clipValue, onTreeReady, viewTrigger, capsGroupRef, 
  onBoundsReady, highlightedIds, isolatedNodeIds, onContextMenu, onModelClick,
  measureMode, currentPicks, setCurrentPicks, measurements, setMeasurements,
  modelBounds
}: any) => {
  const { gl, camera, scene: r3fScene } = useThree();
  const gltf = useGLTF(url) as any;
  const scene = gltf.scene;
  const capsRef = useRef<THREE.Mesh[]>([]);
  
  // 剖切面对象
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);

  useEffect(() => {
    if (!scene) return;
    
    // 计算模型的真实边界，用于设置滑块上下限
    const box = new THREE.Box3().setFromObject(scene);
    if (onBoundsReady) {
      onBoundsReady(box);
    }
    
    // 寻找“第二层级”节点并为其及其所有子 Mesh 分配颜色
    let colorIndex = 0;
    const materialCache = new Map<string, THREE.Material>();
    
    // 我们定义 scene 本身是第 0 层级。它的 children 是第 1 层级。
    // 第 1 层级通常是 "RootNode" 或直接是模型最外层壳。它的 children 才是我们想要的“第二层级”。
    const applyColorToHierarchy = (node: THREE.Object3D, depth: number, inheritedColor?: number) => {
      let currentColor = inheritedColor;

      if (depth === 2) {
        currentColor = PALETTE[colorIndex % PALETTE.length];
        colorIndex++;
      }

      const meshNode = node as any;
      if (meshNode.isMesh && meshNode.material && !meshNode.userData.isStencil && currentColor !== undefined) {
        const materials = Array.isArray(meshNode.material) ? meshNode.material : [meshNode.material];
        
        const newMaterials = materials.map((mat: any) => {
          const cacheKey = `${mat.uuid}_${currentColor}`;
          if (materialCache.has(cacheKey)) {
            return materialCache.get(cacheKey);
          }
          
          const newMat = mat.clone();
          newMat.color.setHex(currentColor);
          newMat.metalness = 0.2;
          newMat.roughness = 0.8;
          materialCache.set(cacheKey, newMat);
          return newMat;
        });

        meshNode.material = Array.isArray(meshNode.material) ? newMaterials : newMaterials[0];
      }

      node.children.forEach(child => {
        if (!child.userData.isStencil) {
          applyColorToHierarchy(child, depth + 1, currentColor);
        }
      });
    };

    applyColorToHierarchy(scene, 0);

    const groups = new Map<number, THREE.Mesh[]>();
    const uncoloredMeshes: THREE.Mesh[] = [];

    scene.traverse((child: any) => {
      if (child.isMesh && child.material && !child.userData.isStencil && !child.userData.isCap) {
         const mat = Array.isArray(child.material) ? child.material[0] : child.material;
         if (mat && mat.color) {
           const hex = mat.color.getHex();
           if (!groups.has(hex)) groups.set(hex, []);
           groups.get(hex)!.push(child);
         } else {
           uncoloredMeshes.push(child);
         }
      }
    });

    if (uncoloredMeshes.length > 0) {
       groups.set(0xaaaaaa, uncoloredMeshes);
    }

    const newCaps: THREE.Mesh[] = [];
    const pendingEdgeMeshes: THREE.Mesh[] = []; // 收集需要建黑边的 mesh，稍后异步分批处理

    // 移除全局黑色底盖，改回独立封盖
    let groupIndex = 1;
    const sharedEdgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });

    groups.forEach((meshes, colorHex) => {
      // z-pass stencil 算法：depthTest:true，只有通过深度测试的面才修改 stencil
      // 背面通过深度测试时 +1，正面通过深度测试时 -1
      // 结果：只有截面内部（奇数计数）区域才绘制盖板，旋转时不会错误累计
      const mat0 = new THREE.MeshBasicMaterial({
        depthWrite: false, depthTest: true, colorWrite: false,
        stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp
      });

      const matBack = mat0.clone();
      matBack.side = THREE.BackSide;
      matBack.stencilZPass = THREE.IncrementWrapStencilOp;

      const matFront = mat0.clone();
      matFront.side = THREE.FrontSide;
      matFront.stencilZPass = THREE.DecrementWrapStencilOp;

      const renderOrderBase = groupIndex * 2;

      meshes.forEach((mesh: any) => {
        const meshBack = new THREE.Mesh(mesh.geometry, matBack);
        meshBack.renderOrder = renderOrderBase;
        meshBack.userData.isStencil = true;
        mesh.add(meshBack);

        const meshFront = new THREE.Mesh(mesh.geometry, matFront);
        meshFront.renderOrder = renderOrderBase;
        meshFront.userData.isStencil = true;
        mesh.add(meshFront);

        // 给原模型加上黑色线框轮廓，推迟到下面异步分批构建以避免初始卡顿
        if (!mesh.userData.hasEdges) {
          pendingEdgeMeshes.push(mesh);
          mesh.userData.hasEdges = true;
        }
      });

      const capGeom = new THREE.PlaneGeometry(10000, 10000);
      const capColor = new THREE.Color(colorHex).offsetHSL(0, 0, -0.05);
      const capMat = new THREE.MeshStandardMaterial({
        color: capColor,
        metalness: 0.1,
        roughness: 0.9,
        depthWrite: false,
        depthTest: false,   // 盖板是无限大平面，不参与深度竞争，由 stencil 决定绘制区域
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,  // stencil != 0 即奇数层内部，绘制盖板
        stencilFail: THREE.KeepStencilOp,
        stencilZFail: THREE.KeepStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,    // 绘制后将 stencil 写回 0，清除本组痕迹
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -groupIndex,
        polygonOffsetUnits: -groupIndex,
      });

      const capMesh = new THREE.Mesh(capGeom, capMat);
      capMesh.renderOrder = renderOrderBase + 1;
      capMesh.visible = false;
      capMesh.userData.isCap = true;
      capMesh.onAfterRender = (renderer) => renderer.clearStencil();

      if (capsGroupRef && capsGroupRef.current) {
        capsGroupRef.current.add(capMesh);
      }
      newCaps.push(capMesh);

      groupIndex++;
    });

    capsRef.current = newCaps;

    // 构建树结构
    const buildTree = (obj: THREE.Object3D): any => {
      return {
        id: obj.uuid,
        name: obj.name,
        visible: obj.visible,
        ref: obj,
        children: obj.children
          .filter(c => c.type === 'Group' || c.type === 'Object3D' || (c.type === 'Mesh' && !c.userData.isStencil && !c.userData.isCap))
          .map(buildTree)
      };
    };

    // 立即传递树结构
    onTreeReady(buildTree(scene));

    // stencil/cap 材质在此已全部同步创建完毕，立即预编译
    // 同时预热「含 clipping planes」的 shader 变体，避免首次开启剖切时闪烁
    requestAnimationFrame(() => {
      try {
        // 先编译无剖切版本
        gl.compile(r3fScene, camera);

        // 给所有 mesh 材质临时注入 clipping plane，触发带 CLIPPING_PLANES 宏的变体生成
        const tempPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e9); // 远在视锥外，不影响画面
        scene.traverse((child: any) => {
          if (child.isMesh && child.material && !child.userData.isCap) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m: any) => {
              if (!m.clippingPlanes || m.clippingPlanes.length === 0) {
                m.clippingPlanes = [tempPlane];
                m.needsUpdate = true;
              }
            });
          }
        });

        // 编译含 clipping 变体
        gl.compile(r3fScene, camera);

        // 还原
        scene.traverse((child: any) => {
          if (child.isMesh && child.material && !child.userData.isCap) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m: any) => {
              if (m.clippingPlanes && m.clippingPlanes[0] === tempPlane) {
                m.clippingPlanes = [];
                m.needsUpdate = true;
              }
            });
          }
        });
      } catch (e) { console.warn('WebGL Compile error:', e); }
    });

    // 分帧异步构建 EdgesGeometry，每帧处理 BATCH 个，避免阻塞主线程
    const BATCH = 10;
    let frameHandle = -1;
    let edgeIdx = 0;
    const buildEdgesBatch = () => {
      const end = Math.min(edgeIdx + BATCH, pendingEdgeMeshes.length);
      for (let i = edgeIdx; i < end; i++) {
        const mesh = pendingEdgeMeshes[i];
        // 可能已被 extractArcFromMesh 按需提前构建，跳过避免重复
        if (mesh.children.some((c: THREE.Object3D) => c.userData.isEdge)) continue;
        const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 15);
        const lineSegments = new THREE.LineSegments(edgesGeom, sharedEdgesMat);
        lineSegments.userData.isEdge = true;
        mesh.add(lineSegments);
      }
      edgeIdx = end;
      if (edgeIdx < pendingEdgeMeshes.length) {
        frameHandle = requestAnimationFrame(buildEdgesBatch);
      } else {
        // 边缘线全部建好后再编译一次，让含 clipping 的 edge shader 也预热
        try { gl.compile(r3fScene, camera); } catch (e) { console.warn('WebGL Compile error:', e); }
      }
    };
    frameHandle = requestAnimationFrame(buildEdgesBatch);

    return () => { if (frameHandle !== -1) cancelAnimationFrame(frameHandle); };
  }, [scene]); // 移除了频繁变化的 gl, camera, r3fScene, onTreeReady 等依赖，仅在 scene 发生变化（首次加载）时执行

  // 剖切逻辑 1：仅更新平面的数学参数（法向量和偏移量）和盖板位置。
  // 这个操作非常轻量，拖动滑块时高频触发也不会引起卡顿，更不能设置 needsUpdate = true
  useEffect(() => {
    if (clipAxis === 'x') {
      plane.normal.set(1, 0, 0);
      plane.constant = -clipValue;
    } else if (clipAxis === 'y') {
      plane.normal.set(0, 1, 0);
      plane.constant = -clipValue;
    } else if (clipAxis === 'z') {
      plane.normal.set(0, 0, 1);
      plane.constant = -clipValue;
    } else {
      plane.normal.set(0, 0, 0);
      plane.constant = 0;
    }

    capsRef.current.forEach(capMesh => {
      if (clipAxis !== 'none') {
        capMesh.visible = true;
        plane.coplanarPoint(capMesh.position);
        capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
      } else {
        capMesh.visible = false;
      }
    });
  }, [clipAxis, clipValue, plane]);

  // 剖切逻辑 2：仅在开启/关闭剖切功能时，修改材质的 clippingPlanes 引用。
  // 这个操作会导致 needsUpdate = true，触发着色器重新编译。必须将 clipValue 从依赖中移除！
  useEffect(() => {
    if (!scene) return;
    const isClipping = clipAxis !== 'none';
    const planes = isClipping ? [plane] : [];

    scene.traverse((child: any) => {
      if (child.isMesh && child.material && !child.userData.isCap) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat: any) => {
          // 长度相同时跳过，避免重复触发编译
          if (mat.clippingPlanes && mat.clippingPlanes.length === planes.length) return;
          mat.clippingPlanes = planes;
          mat.clipShadows = true;
          mat.needsUpdate = true;
        });
      }
      if (child.userData.isEdge && child.material) {
        if (child.material.clippingPlanes && child.material.clippingPlanes.length === planes.length) return;
        child.material.clippingPlanes = planes;
        child.material.needsUpdate = true;
      }
    });
  }, [scene, clipAxis, plane]);

  // 更新高亮状态
  useEffect(() => {
    if (!scene) return;

    // 辅助函数：判断节点是否为目标节点集合的后代
    const isDescendantOfAny = (child: THREE.Object3D, targetIds: string[]) => {
      let current: THREE.Object3D | null = child;
      while (current) {
        if (targetIds.includes(current.uuid)) return true;
        current = current.parent;
      }
      return false;
    };

    const hasHighlight = highlightedIds && highlightedIds.length > 0;

    scene.traverse((child: any) => {
      if (child.isMesh && child.material && !child.userData.isCap && !child.userData.isEdge && !child.userData.isStencil) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat: any) => {
          // 首次保存原始材质透明度状态
          if (mat.userData.originalTransparent === undefined) {
            mat.userData.originalTransparent = mat.transparent || false;
            mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
          }

          if (hasHighlight) {
            const highlighted = isDescendantOfAny(child, highlightedIds);
            if (highlighted) {
              if (mat.transparent !== mat.userData.originalTransparent || mat.opacity !== mat.userData.originalOpacity) {
                mat.transparent = mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity;
                mat.needsUpdate = true;
              }
            } else {
              if (!mat.transparent || mat.opacity !== 0.15) {
                mat.transparent = true;
                mat.opacity = 0.15;
                mat.needsUpdate = true;
              }
            }
          } else {
            // 恢复原始状态
            if (mat.transparent !== mat.userData.originalTransparent || mat.opacity !== mat.userData.originalOpacity) {
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.needsUpdate = true;
            }
          }
        });
      }

      // 同步处理黑色边缘线段的可见性
      if (child.userData.isEdge) {
        if (hasHighlight) {
          const highlighted = isDescendantOfAny(child, highlightedIds);
          child.visible = highlighted;
        } else {
          child.visible = true;
        }
      }
    });

    // 处理内部切面盖板
    capsRef.current.forEach(capMesh => {
      if (capMesh.material) {
        const mat = capMesh.material as THREE.MeshStandardMaterial;
        if (mat.userData.originalTransparent === undefined) {
          mat.userData.originalTransparent = mat.transparent || false;
          mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
        }

        if (hasHighlight) {
          // 由于盖板是被添加到原模型的子层级，我们检查盖板的父节点
          const highlighted = isDescendantOfAny(capMesh.parent!, highlightedIds);
          if (highlighted) {
            if (mat.transparent !== mat.userData.originalTransparent || mat.opacity !== mat.userData.originalOpacity) {
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.needsUpdate = true;
            }
          } else {
            if (!mat.transparent || mat.opacity !== 0.15) {
              mat.transparent = true;
              mat.opacity = 0.15;
              mat.needsUpdate = true;
            }
          }
        } else {
          if (mat.transparent !== mat.userData.originalTransparent || mat.opacity !== mat.userData.originalOpacity) {
            mat.transparent = mat.userData.originalTransparent;
            mat.opacity = mat.userData.originalOpacity;
            mat.needsUpdate = true;
          }
        }
      }
    });

  }, [scene, highlightedIds]);

  // 孤立状态控制
  useEffect(() => {
    if (!scene) return;
    const hasIsolated = isolatedNodeIds && isolatedNodeIds.length > 0;

    // 重点分析：如果当前模型处于高亮模式（透明化）或者孤立模式（隐藏其他），
    // 射线检测（Raycaster）的默认行为可能会穿透透明物体，或者无法击中被隐藏的物体。
    // 但是 Three.js / R3F 的 onClick 是基于 Raycaster 实现的。
    // 如果测量时点不中，很可能是因为被点中的网格：
    // 1. 被我们在前面通过 userData.isEdge / isCap 等拦截了。
    // 2. 网格不可见 (visible = false)。
    // 3. R3F 的事件系统中，e.object 不是真正的 Mesh（可能是 Group）。

    if (hasIsolated) {
      // 保存并隐藏
      scene.traverse((c: any) => {
        if (c.userData.preIsolateVisible === undefined) {
          c.userData.preIsolateVisible = c.visible;
        }
        c.visible = false;
      });

      // 找到目标节点集合
      isolatedNodeIds.forEach((id: string) => {
        const isolatedNode = scene.getObjectByProperty('uuid', id);
        if (isolatedNode) {
          // 恢复其后代原本的可见性
          isolatedNode.traverse((c: any) => {
            if (c.userData.preIsolateVisible) {
              c.visible = true;
            }
          });
          // 确保所有祖先可见
          let curr: any = isolatedNode;
          while (curr) {
            curr.visible = true;
            curr = curr.parent;
          }
        }
      });
    } else {
      // 恢复所有节点的可见性
      scene.traverse((c: any) => {
        if (c.userData.preIsolateVisible !== undefined) {
          c.visible = c.userData.preIsolateVisible;
          delete c.userData.preIsolateVisible;
        }
      });
    }
  }, [scene, isolatedNodeIds]);

  return (
    <Bounds fit observe={false} margin={1.2}>
      <ViewportController viewTrigger={viewTrigger} />
      <MeasureOverlays measurements={measurements} currentPicks={currentPicks} modelBounds={modelBounds} />
      <primitive 
        object={scene} 
        onClick={(e: any) => {
          // 必须调用 stopPropagation，否则事件会穿透冒泡
          e.stopPropagation();

          if (e.delta > 10 && measureMode === 'none') return; 
          
          // 遍历 intersections，找到第一个真正的模型表面（过滤 stencil/cap/edge 辅助对象）
          const validHit = e.intersections.find((hit: any) =>
            !hit.object.userData.isCap &&
            !hit.object.userData.isStencil &&
            !hit.object.userData.isEdge &&
            hit.object.isMesh
          );

          if (!validHit) return;

          const targetObject = validHit.object;
          const targetPoint = validHit.point;
          const targetFace = validHit.face;

          // --- 测量模式逻辑 ---
          if (measureMode !== 'none') {

            const mId = Date.now().toString();
            const SCALE_TO_MM = 1000;

            // 圆弧测量：直接用点击的 mesh，extractArcFromMesh 内部找最近边缘线
            if (measureMode === 'arc') {
              const chain = extractArcFromMesh(targetObject, targetPoint);
              if (chain && chain.length >= 3) {
                const circle = fitCircle3D(chain);
                if (circle) {
                  const radius = circle.radius * SCALE_TO_MM;
                  if (radius > 0.001) {
                    const arcMidPoint = chain[Math.floor(chain.length / 2)];
                    const centerLabel = new THREE.Vector3().addVectors(arcMidPoint, circle.center).multiplyScalar(0.5);
                    setMeasurements([...measurements, {
                      id: mId, type: 'arc', value: radius,
                      linePoints: [circle.center, arcMidPoint],
                      labelPosition: centerLabel,
                      curvePoints: chain
                    }]);
                  } else {
                    alert("选中的曲线太小或非圆弧！");
                  }
                } else {
                  alert("无法基于选中曲线计算圆弧！");
                }
              } else {
                alert("未检测到有效的圆弧边缘，请点击靠近孔洞或倒角的地方。");
              }
              setCurrentPicks([]);
              return;
            }

            // 点点/点面/面面测量：需要 face 法线
            if (!targetFace || !targetFace.normal) {
              console.warn("测量选点失败：所选对象缺少面法线数据", targetObject);
              return;
            }

            const worldNormal = getWorldNormal(targetObject, targetFace.normal);
            const newPoint = { point: targetPoint.clone(), normal: worldNormal };
            const newPicked = [...currentPicks, newPoint];
            setCurrentPicks(newPicked);

            if (measureMode === 'p2p' && newPicked.length === 2) {
              const [p1, p2] = newPicked.map(p => p.point);
              const distance = p1.distanceTo(p2) * SCALE_TO_MM;
              const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
              setMeasurements([...measurements, {
                id: mId, type: 'p2p', value: distance,
                linePoints: [p1, p2], labelPosition: center
              }]);
              setCurrentPicks([]);
            } else if (measureMode === 'p2plane' && newPicked.length === 2) {
              const p1 = newPicked[0].point;
              const p2 = newPicked[1].point;
              const n2 = newPicked[1].normal;
              const vector = new THREE.Vector3().subVectors(p1, p2);
              const distance = Math.abs(vector.dot(n2)) * SCALE_TO_MM;
              const projection = n2.clone().multiplyScalar(vector.dot(n2));
              const footPoint = new THREE.Vector3().subVectors(p1, projection);
              const center = new THREE.Vector3().addVectors(p1, footPoint).multiplyScalar(0.5);
              
              setMeasurements([...measurements, {
                id: mId, type: 'p2plane', value: distance,
                linePoints: [p1, footPoint], labelPosition: center
              }]);
              setCurrentPicks([]);
            } else if (measureMode === 'plane2plane' && newPicked.length === 2) {
              const n1 = newPicked[0].normal;
              const n2 = newPicked[1].normal;
              if (Math.abs(n1.dot(n2)) < 0.99) {
                alert("所选平面不平行，无法测量面面距离！");
                setCurrentPicks([]);
                return;
              }
              const p1 = newPicked[0].point;
              const p2 = newPicked[1].point;
              const vector = new THREE.Vector3().subVectors(p1, p2);
              const distance = Math.abs(vector.dot(n2)) * SCALE_TO_MM;
              const projection = n2.clone().multiplyScalar(vector.dot(n2));
              const footPoint = new THREE.Vector3().subVectors(p1, projection);
              const center = new THREE.Vector3().addVectors(p1, footPoint).multiplyScalar(0.5);

              setMeasurements([...measurements, {
                id: mId, type: 'plane2plane', value: distance,
                linePoints: [p1, footPoint], labelPosition: center
              }]);
              setCurrentPicks([]);
            }
            return;
          }

          // 测量模式之外的点击不触发高亮，高亮仅通过右侧结构树操作
          return;
        }}
        onContextMenu={(e: any) => {
          e.stopPropagation();
          if (e.delta > 5) return; // 同样忽略右键平移时的误触
          
          const validHit = e.intersections.find((hit: any) => 
            !hit.object.userData.isCap && 
            !hit.object.userData.isStencil && 
            !hit.object.userData.isEdge &&
            hit.object.isMesh
          );

          if (onContextMenu && validHit) {
            onContextMenu(e, validHit.object.uuid);
          }
        }}
      />
    </Bounds>
  );
};

export const ModelViewer3D = ({ src, pdfSrc }: { src: string; pdfSrc?: string | null }) => {
  const capsGroupRef = useRef<THREE.Group>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [clipAxis, setClipAxis] = useState('none'); // none, x, y, z
  const [clipValue, setClipValue] = useState(0);
  const [modelBounds, setModelBounds] = useState<THREE.Box3 | null>(null);
  const [viewTrigger, setViewTrigger] = useState<{ axis: [number, number, number], time: number } | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [isolatedNodeIds, setIsolatedNodeIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, nodeId: string} | null>(null);

  // 测量状态
  const [measureMode, setMeasureMode] = useState<MeasureMode>('none');
  const [currentPicks, setCurrentPicks] = useState<PickedData[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // PDF 预览状态
  const [showPdf, setShowPdf] = useState(false);

  const handleContextMenu = useCallback((e: any, id: string) => {
    e.preventDefault();
    const clientX = e.clientX ?? (e.nativeEvent && e.nativeEvent.clientX);
    const clientY = e.clientY ?? (e.nativeEvent && e.nativeEvent.clientY);
    setContextMenu({ x: clientX, y: clientY, nodeId: id });
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleToggleNode = useCallback((ref: THREE.Object3D, visible: boolean) => {
    ref.visible = visible;
  }, []);

  const handleHighlightNode = useCallback((id: string, multi: boolean) => {
    setHighlightedIds(prev => {
      if (multi) {
        if (prev.includes(id)) {
          return prev.filter(i => i !== id);
        } else {
          return [...prev, id];
        }
      } else {
        if (prev.length === 1 && prev[0] === id) {
          return []; // 再次点击取消高亮
        }
        return [id];
      }
    });
  }, []);

  const triggerView = (axis: [number, number, number]) => {
    setViewTrigger({ axis, time: Date.now() });
  };

  // 动态获取滑块的上下限
  const sliderMin = useMemo(() => {
    if (!modelBounds || clipAxis === 'none') return -150;
    // 增加 10% 的缓冲余量，避免最值时刚好切掉或留下一层导致异常
    const paddingX = (modelBounds.max.x - modelBounds.min.x) * 0.1 || 1;
    const paddingY = (modelBounds.max.y - modelBounds.min.y) * 0.1 || 1;
    const paddingZ = (modelBounds.max.z - modelBounds.min.z) * 0.1 || 1;
    
    if (clipAxis === 'x') return modelBounds.min.x - paddingX;
    if (clipAxis === 'y') return modelBounds.min.y - paddingY;
    if (clipAxis === 'z') return modelBounds.min.z - paddingZ;
    return -150;
  }, [modelBounds, clipAxis]);

  const sliderMax = useMemo(() => {
    if (!modelBounds || clipAxis === 'none') return 150;
    const paddingX = (modelBounds.max.x - modelBounds.min.x) * 0.1 || 1;
    const paddingY = (modelBounds.max.y - modelBounds.min.y) * 0.1 || 1;
    const paddingZ = (modelBounds.max.z - modelBounds.min.z) * 0.1 || 1;

    if (clipAxis === 'x') return modelBounds.max.x + paddingX;
    if (clipAxis === 'y') return modelBounds.max.y + paddingY;
    if (clipAxis === 'z') return modelBounds.max.z + paddingZ;
    return 150;
  }, [modelBounds, clipAxis]);

  return (
    <div className="w-full h-full flex bg-dark-900 relative">
      {/* 快速视图工具栏 */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button onClick={() => triggerView([0, 0, 1])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">正视图</button>
        <button onClick={() => triggerView([0, 0, -1])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">后视图</button>
        <button onClick={() => triggerView([-1, 0, 0])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">左视图</button>
        <button onClick={() => triggerView([1, 0, 0])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">右视图</button>
        <button onClick={() => triggerView([0, 1, 0])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">俯视图</button>
        <button onClick={() => triggerView([0, -1, 0])} className="px-3 py-1.5 bg-dark-800/90 text-white rounded border border-dark-600 hover:bg-dark-700 hover:border-blue-500 text-sm shadow transition-colors">仰视图</button>
      </div>

      {/* 测量工具栏 */}
      <div className="absolute top-16 left-4 z-10 flex gap-2">
        <button 
          onClick={() => { setMeasureMode(measureMode === 'p2p' ? 'none' : 'p2p'); setCurrentPicks([]); }} 
          className={`px-3 py-1.5 rounded border text-sm shadow transition-colors ${measureMode === 'p2p' ? 'bg-blue-600 text-white border-blue-400' : 'bg-dark-800/90 text-slate-300 border-dark-600 hover:bg-dark-700'}`}
        >点点测量</button>
        <button 
          onClick={() => { setMeasureMode(measureMode === 'p2plane' ? 'none' : 'p2plane'); setCurrentPicks([]); }} 
          className={`px-3 py-1.5 rounded border text-sm shadow transition-colors ${measureMode === 'p2plane' ? 'bg-blue-600 text-white border-blue-400' : 'bg-dark-800/90 text-slate-300 border-dark-600 hover:bg-dark-700'}`}
        >点面测量</button>
        <button 
          onClick={() => { setMeasureMode(measureMode === 'plane2plane' ? 'none' : 'plane2plane'); setCurrentPicks([]); }} 
          className={`px-3 py-1.5 rounded border text-sm shadow transition-colors ${measureMode === 'plane2plane' ? 'bg-blue-600 text-white border-blue-400' : 'bg-dark-800/90 text-slate-300 border-dark-600 hover:bg-dark-700'}`}
        >面面测量</button>
        <button 
          onClick={() => { setMeasureMode(measureMode === 'arc' ? 'none' : 'arc'); setCurrentPicks([]); }} 
          className={`px-3 py-1.5 rounded border text-sm shadow transition-colors ${measureMode === 'arc' ? 'bg-blue-600 text-white border-blue-400' : 'bg-dark-800/90 text-slate-300 border-dark-600 hover:bg-dark-700'}`}
        >圆弧半径</button>
        {measurements.length > 0 && (
          <button 
            onClick={() => { setMeasurements([]); setCurrentPicks([]); setMeasureMode('none'); }} 
            className="px-3 py-1.5 bg-red-900/80 text-white rounded border border-red-700 hover:bg-red-800 text-sm shadow transition-colors"
          >清除测量</button>
        )}
      </div>

      {/* 拆解报告预览按钮：仅当有 PDF 时显示 */}
      {pdfSrc && (
      <div className="absolute top-28 left-4 z-10">
        <button
          onClick={() => setShowPdf(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600/90 hover:bg-purple-500 text-white text-sm font-medium rounded shadow-[0_0_10px_rgba(147,51,234,0.3)] border border-purple-400 transition-all"
        >
          <DocumentTextIcon className="w-4 h-4" />
          拆解报告预览
        </button>
      </div>
      )}

      {/* 测量提示文本 */}
      {measureMode !== 'none' && (
        <div className="absolute top-40 left-4 z-10 bg-blue-900/80 text-blue-100 px-4 py-2 rounded border border-blue-700 text-sm shadow pointer-events-none">
          {measureMode === 'p2p' && `点点测量: 请在模型上点击 2 个点 (${currentPicks.length}/2)`}
          {measureMode === 'p2plane' && `点面测量: 第1点为起点，第2点为目标面 (${currentPicks.length}/2)`}
          {measureMode === 'plane2plane' && `面面测量: 请依次点击两个平行的平面 (${currentPicks.length}/2)`}
          {measureMode === 'arc' && `圆弧测量: 请点击模型上孔洞或圆柱的边缘曲线 (点击 1 次自动提取)`}
        </div>
      )}

      {/* 退出孤立按钮 */}
      {isolatedNodeIds.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <button 
            onClick={() => setIsolatedNodeIds([])}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400 transition-all"
          >
            <EyeIcon className="w-4 h-4" />
            退出孤立
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div 
          className="fixed z-[9999] bg-dark-800 border border-dark-600 shadow-xl rounded py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-blue-600 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // 如果目标节点已经被孤立，则取消其孤立状态
              if (isolatedNodeIds.includes(contextMenu.nodeId)) {
                setIsolatedNodeIds(prev => prev.filter(id => id !== contextMenu.nodeId));
              } else {
                // 如果当前处于多选状态且目标节点被选中，则孤立所有被选中的节点
                if (highlightedIds.includes(contextMenu.nodeId) && highlightedIds.length > 1) {
                  setIsolatedNodeIds(highlightedIds);
                } else {
                  setIsolatedNodeIds([contextMenu.nodeId]);
                }
              }
              setContextMenu(null);
            }}
          >
            {isolatedNodeIds.includes(contextMenu.nodeId) ? '退出孤立' : (highlightedIds.includes(contextMenu.nodeId) && highlightedIds.length > 1 ? '孤立显示所选' : '孤立显示')}
          </button>
        </div>
      )}

      {/* 左侧：3D 渲染区域 */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 500], fov: 50, near: 0.001, far: 1000000 }} gl={{ stencil: true }}>
          <RendererSettings />
          <ambientLight intensity={1.2} />
          <hemisphereLight args={[0xffffff, 0x444444, 1.0]} />
          <directionalLight position={[500, 500, 500]} intensity={1.5} />
          
          <Suspense fallback={<Loader />}>
            <ModelScene 
              url={src} 
              clipAxis={clipAxis} 
              clipValue={clipValue} 
              onTreeReady={setTreeData} 
              viewTrigger={viewTrigger}
              capsGroupRef={capsGroupRef}
              onBoundsReady={setModelBounds}
              highlightedIds={highlightedIds}
              isolatedNodeIds={isolatedNodeIds}
              onContextMenu={handleContextMenu}
              onModelClick={handleHighlightNode}
              measureMode={measureMode}
              currentPicks={currentPicks}
              setCurrentPicks={setCurrentPicks}
              measurements={measurements}
              setMeasurements={setMeasurements}
              modelBounds={modelBounds}
            />
          </Suspense>
          
          {/* 将无限大的截面封盖放在 Bounds 之外，避免干扰居中计算 */}
          <group ref={capsGroupRef} />

          <OrbitControls makeDefault minDistance={0.01} maxDistance={10000} zoomSpeed={1.5} enableDamping={false} />
          
          {/* 左下角坐标系 */}
          <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
            <GizmoViewport axisColors={['#ff3653', '#8adb00', '#2c8fdf']} labelColor="white" />
          </GizmoHelper>
        </Canvas>

        {/* 底部控制栏（剖切面控制） */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-dark-800/80 backdrop-blur border border-dark-700 p-4 rounded-xl shadow-lg flex items-center gap-4">
          <span className="text-sm text-slate-300 font-medium whitespace-nowrap">剖切方向:</span>
          <select 
            value={clipAxis}
            onChange={(e) => {
              setClipAxis(e.target.value);
              setClipValue(0);
            }}
            className="bg-dark-900 border border-dark-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="none">无</option>
            <option value="x">X 轴</option>
            <option value="y">Y 轴</option>
            <option value="z">Z 轴</option>
          </select>

          {clipAxis !== 'none' && (
            <>
              <span className="text-sm text-slate-300 font-medium whitespace-nowrap ml-2">切面位置:</span>
              <input 
                type="range" 
                min={sliderMin} 
                max={sliderMax} 
                step="0.01"
                value={clipValue}
                onChange={(e) => setClipValue(parseFloat(e.target.value))}
                className="w-32 accent-blue-500"
              />
              <span className="text-xs text-slate-400 w-8">{clipValue.toFixed(1)}</span>
            </>
          )}
        </div>
      </div>

      {/* 右侧：模型零件树 */}
      <div className="w-72 bg-dark-800 border-l border-dark-700 flex flex-col">
        <div className="p-4 border-b border-dark-700">
          <h4 className="text-white font-semibold flex items-center gap-2">
            <CubeIcon className="w-5 h-5 text-blue-400" />
            模型结构树
          </h4>
          <p className="text-xs text-slate-400 mt-1">点击眼睛图标可隐藏外壳或内部零件</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {treeData ? (
            <TreeNode node={treeData} onToggle={handleToggleNode} onHighlight={handleHighlightNode} highlightedIds={highlightedIds} onContextMenu={handleContextMenu} />
          ) : (
            <div className="text-sm text-slate-500 text-center mt-10">解析模型中...</div>
          )}
        </div>
      </div>

      {/* PDF 预览模态框 */}
      {showPdf && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-6xl h-full max-h-[90vh] rounded-xl border border-dark-600 flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-dark-700 bg-dark-900">
              <h3 className="text-white font-medium flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-purple-400" />
                拆解报告
              </h3>
              <button
                onClick={() => setShowPdf(false)}
                className="p-1 rounded hover:bg-dark-700 text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-white">
              <iframe
                src={pdfSrc!}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
