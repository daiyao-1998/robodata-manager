import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Bounds, useBounds, Html, useProgress, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { EyeIcon, EyeSlashIcon, CubeIcon } from '@heroicons/react/24/outline';

// 递归树节点组件
const TreeNode = ({ node, onToggle }: { node: any, onToggle: (ref: any, visible: boolean) => void }) => {
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
          <TreeNode key={c.id} node={c} onToggle={onToggle} />
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

  return (
    <div className="pl-3">
      <div className="flex items-center gap-2 py-1 px-1 text-sm text-slate-300 hover:bg-dark-600/50 rounded transition-colors">
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white"
        >
          {hasChildren ? (expanded ? '▾' : '▸') : <CubeIcon className="w-3 h-3 opacity-50" />}
        </button>
        <button onClick={handleToggle} className={`${visible ? 'text-blue-400' : 'text-slate-600'} hover:text-blue-300 transition-colors`}>
          {visible ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
        </button>
        <span className="truncate select-none cursor-default" title={node.name}>{node.name || 'Unnamed'}</span>
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-dark-600 ml-2">
          {node.children.map((c: any) => (
            <TreeNode key={c.id} node={c} onToggle={onToggle} />
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
    gl.toneMapping = THREE.NoToneMapping; // 取消色调映射，避免某些模型被映射成黑色
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
const ModelScene = ({ url, clipAxis, clipValue, onTreeReady, viewTrigger, capsGroupRef, onBoundsReady }: any) => {
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
        materials.forEach((mat: any) => {
          if (!mat.userData.isCloned) {
            const newMat = mat.clone();
            newMat.userData.isCloned = true;
            newMat.color.setHex(currentColor);
            newMat.metalness = 0.2;
            newMat.roughness = 0.8;
            if (Array.isArray(meshNode.material)) {
              meshNode.material[meshNode.material.indexOf(mat)] = newMat;
            } else {
              meshNode.material = newMat;
            }
          }
        });
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

    // 移除全局黑色底盖，改回独立封盖
    let groupIndex = 1;

    groups.forEach((meshes, colorHex) => {
      const mat0 = new THREE.MeshBasicMaterial({
        depthWrite: false, depthTest: false, colorWrite: false,
        stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc
      });

      const matBack = mat0.clone();
      matBack.side = THREE.BackSide;
      matBack.stencilFail = THREE.IncrementWrapStencilOp;
      matBack.stencilZFail = THREE.IncrementWrapStencilOp;
      matBack.stencilZPass = THREE.IncrementWrapStencilOp;

      const matFront = mat0.clone();
      matFront.side = THREE.FrontSide;
      matFront.stencilFail = THREE.DecrementWrapStencilOp;
      matFront.stencilZFail = THREE.DecrementWrapStencilOp;
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
        
        // 给原模型加上黑色线框轮廓，只在边缘显示，并受剖切影响
        if (!mesh.userData.hasEdges) {
          const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 15);
          const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
          const lineSegments = new THREE.LineSegments(edgesGeom, edgesMat);
          lineSegments.userData.isEdge = true;
          mesh.add(lineSegments);
          mesh.userData.hasEdges = true;
        }
      });

      const capGeom = new THREE.PlaneGeometry(10000, 10000);
      const capColor = new THREE.Color(colorHex).offsetHSL(0, 0, -0.05);
      const capMat = new THREE.MeshStandardMaterial({
        color: capColor,
        metalness: 0.1,
        roughness: 0.9,
        stencilWrite: true,
        stencilRef: 0,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilFail: THREE.ReplaceStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
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

    // 延迟一帧传递树结构，避免 React 渲染冲突
    setTimeout(() => {
      onTreeReady(buildTree(scene));
    }, 0);
  }, [scene, onTreeReady, capsGroupRef]);

  // 更新剖切面
  useEffect(() => {
    // 根据 Three.js 的 Plane 定义：
    // plane.distanceToPoint(p) = normal.dot(p) + constant
    // 剖切的保留区域是 distanceToPoint(p) > 0 的点。
    // 即 normal.dot(p) > -constant。
    // 若要保留 > clipValue 的区域：
    // normal = (1,0,0), 保留 x > clipValue => x > -constant => constant = -clipValue。
    // 但是，为了符合常规人类认知：向右拉滑块，切面从左往右移动，左侧物体消失，右侧保留。
    // 即滑块代表切面位置 clipValue，我们需要保留的是 `x > clipValue` 的部分。
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

    // 遍历模型，应用剖切
    scene.traverse((child: any) => {
      if (child.isMesh && child.material && !child.userData.isCap) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat: any) => {
          mat.clippingPlanes = clipAxis !== 'none' ? [plane] : [];
          mat.clipShadows = true;
          mat.needsUpdate = true;
        });
      }
      if (child.userData.isEdge) {
        child.material.clippingPlanes = clipAxis !== 'none' ? [plane] : [];
        child.material.needsUpdate = true;
      }
    });

    capsRef.current.forEach(capMesh => {
      if (clipAxis !== 'none') {
        capMesh.visible = true;
        plane.coplanarPoint(capMesh.position);
        capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), plane.normal);
      } else {
        capMesh.visible = false;
      }
    });
  }, [scene, clipAxis, clipValue, plane]);

  return (
    <Bounds fit observe margin={1.2}>
      <ViewportController viewTrigger={viewTrigger} />
      <primitive object={scene} />
    </Bounds>
  );
};

export const ModelViewer3D = ({ src }: { src: string }) => {
  const capsGroupRef = useRef<THREE.Group>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [clipAxis, setClipAxis] = useState('none'); // none, x, y, z
  const [clipValue, setClipValue] = useState(0);
  const [modelBounds, setModelBounds] = useState<THREE.Box3 | null>(null);
  const [viewTrigger, setViewTrigger] = useState<{ axis: [number, number, number], time: number } | null>(null);

  const handleToggleNode = useCallback((ref: THREE.Object3D, visible: boolean) => {
    ref.visible = visible;
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

      {/* 左侧：3D 渲染区域 */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 500], fov: 50, near: 0.001, far: 1000000 }} gl={{ stencil: true, logarithmicDepthBuffer: true }}>
          <RendererSettings />
          <ambientLight intensity={1.5} />
          <hemisphereLight args={[0xffffff, 0x444444, 1.0]} />
          <directionalLight position={[500, 500, 500]} intensity={1.5} />
          <directionalLight position={[-500, -500, -500]} intensity={0.5} />
          <directionalLight position={[0, 500, 0]} intensity={1.0} />
          <directionalLight position={[0, -500, 0]} intensity={0.5} />
          <pointLight position={[0, 0, 500]} intensity={1.0} />
          
          <Suspense fallback={<Loader />}>
            <ModelScene 
              url={src} 
              clipAxis={clipAxis} 
              clipValue={clipValue} 
              onTreeReady={setTreeData} 
              viewTrigger={viewTrigger}
              capsGroupRef={capsGroupRef}
              onBoundsReady={setModelBounds}
            />
          </Suspense>
          
          {/* 将无限大的截面封盖放在 Bounds 之外，避免干扰居中计算 */}
          <group ref={capsGroupRef} />

          <OrbitControls makeDefault minDistance={0.01} maxDistance={10000} zoomSpeed={1.5} />
          
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
            <TreeNode node={treeData} onToggle={handleToggleNode} />
          ) : (
            <div className="text-sm text-slate-500 text-center mt-10">解析模型中...</div>
          )}
        </div>
      </div>
    </div>
  );
};
