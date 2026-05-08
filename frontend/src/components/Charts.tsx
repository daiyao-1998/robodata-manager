import React, { useState, useMemo, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from '../store';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { WidthProvider, Responsive } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const METRIC_OPTIONS = [
  { key: 'peak_torque', label: '峰值扭矩 (Nm)' },
  { key: 'nominal_torque', label: '额定扭矩 (Nm)' },
  { key: 'start_stop_torque', label: '启停扭矩 (Nm)' },
  { key: 'stall_torque', label: '堵转扭矩 (Nm)' },
  { key: 'peak_speed', label: '峰值转速 (rpm)' },
  { key: 'nominal_speed', label: '额定转速 (rpm)' },
  { key: 'peak_torque_density', label: '峰值扭矩密度 (Nm/kg)' },
  { key: 'nominal_torque_density', label: '额定扭矩密度 (Nm/kg)' },
  { key: 'response_time', label: '响应时间 (ms)' },
  { key: 'speed_fluctuation', label: '转速波动 (%)' },
  { key: 'torque_fluctuation', label: '转矩波动 (%)' },
  { key: 'overload_time_1_5x', label: '1.5倍过载时间 (s)' },
  { key: 'overload_time_2x', label: '2倍过载时间 (s)' },
  { key: 'overload_time_2_5x', label: '2.5倍过载时间 (s)' },
  { key: 'overload_time_3x', label: '3倍过载时间 (s)' },
  { key: 'weight', label: '重量 (kg)' },
  { key: 'actuator_outer_diameter', label: '执行器外径 (mm)' },
  { key: 'actuator_hollow_diameter', label: '执行器中空直径 (mm)' },
  { key: 'actuator_axial_length', label: '执行器轴向长度 (mm)' },
  { key: 'stator_inner_diameter', label: '电机定子内径 (mm)' },
  { key: 'stator_outer_diameter', label: '电机定子外径 (mm)' },
  { key: 'rotor_inner_diameter', label: '电机转子内径 (mm)' },
  { key: 'rotor_outer_diameter', label: '电机转子外径 (mm)' },
];

interface ChartItem {
  id: string;
  metrics: string[];
}

export const Charts: React.FC = () => {
  const modules = useStore(state => state.modules);
  
  // 按制造商对模块名称进行分组
  const modulesByManufacturer = useMemo(() => {
    const groups: { [key: string]: string[] } = {};
    modules.forEach(m => {
      const mfr = m.manufacturer || '未知制造商';
      if (!groups[mfr]) {
        groups[mfr] = [];
      }
      if (m.name && !groups[mfr].includes(m.name)) {
        groups[mfr].push(m.name);
      }
    });
    return groups;
  }, [modules]);

  // 提取所有独一无二的执行器名称列表
  const allModuleNames = useMemo(() => {
    const names = modules.map(m => m.name);
    return Array.from(new Set(names)).filter(Boolean);
  }, [modules]);

  // 选中的执行器，默认为全部选中
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [namesInitialized, setNamesInitialized] = useState(false);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!namesInitialized && allModuleNames.length > 0) {
      setSelectedNames(allModuleNames);
      setNamesInitialized(true);
    }
  }, [allModuleNames, namesInitialized]);

  // 经过名称筛选后的模块数据
  const filteredModules = useMemo(() => {
    return modules.filter(m => selectedNames.includes(m.name));
  }, [modules, selectedNames]);

  // 维护图表配置列表
  const [charts, setCharts] = useState<ChartItem[]>([
    { id: 'chart-1', metrics: ['peak_torque', 'nominal_torque'] },
    { id: 'chart-2', metrics: ['peak_torque_density', 'nominal_torque_density'] }
  ]);

  // 维护网格布局状态
  const [layouts, setLayouts] = useState<{ [key: string]: any[] }>({
    lg: [
      { i: 'chart-1', x: 0, y: 0, w: 6, h: 10 },
      { i: 'chart-2', x: 6, y: 0, w: 6, h: 10 }
    ]
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newChartMetrics, setNewChartMetrics] = useState<string[]>([]);

  const handleAddChart = () => {
    if (newChartMetrics.length > 0) {
      const newId = `chart-${Date.now()}`;
      setCharts([...charts, { id: newId, metrics: newChartMetrics }]);
      
      // 为新图表添加默认的布局配置
      const newLayoutItem: any = { 
        i: newId, 
        x: (charts.length * 6) % 12, 
        y: Infinity, // 自动放到最下面
        w: 6, 
        h: 10 
      };
      
      const newLgLayout = [...(layouts.lg || []), newLayoutItem];
      setLayouts({ ...layouts, lg: newLgLayout });
      
      setNewChartMetrics([]);
      setIsAdding(false);
    }
  };

  const removeChart = (id: string) => {
    setCharts(charts.filter(c => c.id !== id));
    // 从布局中移除（非必须，因为布局组件会自动过滤，但保持干净更好）
    const newLgLayout = layouts.lg?.filter(l => l.i !== id) || [];
    setLayouts({ ...layouts, lg: newLgLayout });
  };

  const onLayoutChange = (_layout: any, allLayouts: any) => {
    setLayouts(allLayouts);
  };

  const getChartOption = (metrics: string[]) => {
    // 检查是否包含密度计算指标
    const hasDensity = metrics.includes('peak_torque_density') || metrics.includes('nominal_torque_density');

    if (hasDensity) {
      // 如果包含密度指标，则使用散点图 (Torque vs Weight)
      const isPeak = metrics.includes('peak_torque_density');
      const isNominal = metrics.includes('nominal_torque_density');
      
      const seriesData = [];
      if (isPeak) {
        seriesData.push({
          name: '峰值扭矩密度 (Nm/kg)',
          type: 'scatter',
          symbolSize: 15,
          data: filteredModules.filter(m => m.weight && m.peak_torque).map(m => [m.weight || 0, m.peak_torque || 0, m.name]),
          itemStyle: { color: '#f59e0b' },
          label: { show: showLabels, formatter: '{@[2]}', position: 'top', color: '#cbd5e1', fontSize: 10 }
        });
      }
      if (isNominal) {
        seriesData.push({
          name: '额定扭矩密度 (Nm/kg)',
          type: 'scatter',
          symbolSize: 15,
          data: filteredModules.filter(m => m.weight && m.nominal_torque).map(m => [m.weight || 0, m.nominal_torque || 0, m.name]),
          itemStyle: { color: '#10b981' },
          label: { show: showLabels, formatter: '{@[2]}', position: 'top', color: '#cbd5e1', fontSize: 10 }
        });
      }

      return {
        title: { text: '扭矩与重量关系 (密度)', textStyle: { color: '#e2e8f0', fontSize: 14 }, top: 0, left: 'center' },
        tooltip: {
          formatter: function (param: any) {
            const density = (param.data[1] / param.data[0]).toFixed(2);
            return `${param.data[2]}<br/>重量: ${param.data[0]} kg<br/>扭矩: ${param.data[1]} Nm<br/>密度: ${density} Nm/kg`;
          }
        },
        legend: {
          data: seriesData.map(s => s.name),
          textStyle: { color: '#cbd5e1' },
          bottom: 0
        },
        grid: { top: '15%', left: '5%', right: '5%', bottom: '15%', containLabel: true },
        xAxis: {
          name: '重量 (kg)',
          nameTextStyle: { color: '#94a3b8' },
          type: 'value',
          splitLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8' }
        },
        yAxis: {
          name: '扭矩 (Nm)',
          nameTextStyle: { color: '#94a3b8' },
          type: 'value',
          splitLine: { lineStyle: { color: '#334155' } },
          axisLabel: { color: '#94a3b8' }
        },
        series: seriesData
      };
    }

    // 默认情况：渲染横向柱状图 (方法C)
    const names = filteredModules.map(m => m.name);
    const series = metrics.map(metricKey => {
      const metricDef = METRIC_OPTIONS.find(opt => opt.key === metricKey);
      return {
        name: metricDef?.label || metricKey,
        type: 'bar',
        data: filteredModules.map((m: any) => m[metricKey] || 0),
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: showLabels,
          position: 'right',
          color: '#cbd5e1',
          fontSize: 10,
        }
      };
    });

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        data: series.map(s => s.name),
        textStyle: { color: '#cbd5e1' },
        top: 0
      },
      grid: { top: '15%', left: '3%', right: '8%', bottom: '5%', containLabel: true },
      dataZoom: [
        {
          type: 'slider',
          yAxisIndex: 0,
          right: 10,
          start: 0,
          end: names.length > 15 ? (15 / names.length) * 100 : 100, // 默认显示约15个执行器以保证柱子不过细
          textStyle: { color: '#94a3b8' }
        },
        {
          type: 'inside',
          yAxisIndex: 0
        }
      ],
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { 
          color: '#94a3b8',
          interval: 0,
          width: 100,
          overflow: 'truncate'
        },
        inverse: true // 反转Y轴，让第一个数据在最上面
      },
      series: series
    };
  };

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-dark-800 border border-dark-700 p-4 rounded-xl shadow-sm">
        <div className="flex flex-col flex-1">
          <span className="text-sm font-medium text-slate-400 mb-3">选择要显示数据的执行器名称:</span>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
              <button 
                onClick={() => setSelectedNames(allModuleNames)}
                className="text-xs px-3 py-1.5 rounded bg-dark-700 text-slate-300 hover:bg-dark-600 transition"
              >
                全部显示
              </button>
              <button 
                onClick={() => setSelectedNames([])}
                className="text-xs px-3 py-1.5 rounded bg-dark-700 text-slate-300 hover:bg-dark-600 transition mr-2"
              >
                全部隐藏
              </button>
            </div>
            
            {Object.entries(modulesByManufacturer).map(([mfr, names]) => {
              const allSelected = names.length > 0 && names.every(n => selectedNames.includes(n));
              const someSelected = names.some(n => selectedNames.includes(n));
              
              return (
                <div key={mfr} className="flex flex-wrap gap-2 items-center pl-3 border-l-2 border-dark-600">
                  <span className="text-xs text-slate-400 font-medium w-20 truncate" title={mfr}>{mfr}:</span>
                  <button
                    onClick={() => {
                      if (allSelected) {
                        setSelectedNames(selectedNames.filter(n => !names.includes(n)));
                      } else {
                        const newSelected = new Set([...selectedNames, ...names]);
                        setSelectedNames(Array.from(newSelected));
                      }
                    }}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      allSelected ? 'bg-primary-500/20 text-primary-400' : 
                      someSelected ? 'bg-primary-500/10 text-primary-400/70' : 'bg-dark-700 text-slate-400 hover:bg-dark-600'
                    }`}
                  >
                    {allSelected ? '全不选' : '全选'}
                  </button>
                  <div className="w-px h-4 bg-dark-600 mx-1"></div>
                  {names.map(modName => {
                    const isSelected = selectedNames.includes(modName);
                    return (
                      <button
                        key={modName}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedNames(selectedNames.filter(m => m !== modName));
                          } else {
                            setSelectedNames([...selectedNames, modName]);
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          isSelected 
                            ? 'bg-primary-500/20 border-primary-500 text-primary-400' 
                            : 'bg-dark-900 border-dark-700 text-slate-500 hover:border-slate-500'
                        }`}
                      >
                        {modName}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 border-l border-dark-700 pl-4 h-full self-stretch">
          <span className="text-sm text-slate-300">显示数值</span>
          <button 
            onClick={() => setShowLabels(!showLabels)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showLabels ? 'bg-primary-500' : 'bg-dark-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showLabels ? 'translate-x-4.5' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">性能对比图表</h2>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-400"
          >
            <PlusIcon className="h-4 w-4" /> 添加对比图表
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mb-6 rounded-xl border border-dark-700 bg-dark-800 p-4 shadow-lg">
          <h3 className="text-sm font-medium text-slate-300 mb-3">选择要在新图表中对比的项目 (可多选):</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {METRIC_OPTIONS.map(opt => {
              const isSelected = newChartMetrics.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (isSelected) setNewChartMetrics(newChartMetrics.filter(k => k !== opt.key));
                    else setNewChartMetrics([...newChartMetrics, opt.key]);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-900 border-dark-600 text-slate-400 hover:border-slate-400'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={handleAddChart} disabled={newChartMetrics.length === 0} className="rounded bg-green-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed">确认添加</button>
            <button onClick={() => { setIsAdding(false); setNewChartMetrics([]); }} className="rounded bg-dark-700 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-dark-600">取消</button>
          </div>
        </div>
      )}

      {charts.length > 0 ? (
        <ResponsiveGridLayout
          className="layout -mx-2"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle"
        >
          {charts.map((chart) => (
            <div key={chart.id} className="relative rounded-xl border border-dark-700 bg-dark-800 shadow-lg group flex flex-col overflow-hidden">
              <div className="drag-handle absolute top-0 left-0 right-0 h-6 cursor-move bg-dark-700/80 rounded-t-xl opacity-0 group-hover:opacity-100 transition z-20 flex items-center justify-center backdrop-blur-sm">
                <span className="text-xs text-slate-300">拖拽此处移动位置</span>
              </div>
              <button 
                onClick={() => removeChart(chart.id)}
                className="absolute top-1 right-2 p-1 rounded-full bg-dark-600 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition z-30 shadow-md"
                title="移除图表"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
              <div className="flex-1 w-full h-full p-2 pt-6 pb-2">
                <ReactECharts 
                  option={getChartOption(chart.metrics)} 
                  style={{ height: '100%', width: '100%' }} 
                  notMerge={true} 
                />
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        !isAdding && (
          <div className="text-center py-10 text-slate-500 border border-dashed border-dark-700 rounded-xl">
            暂无对比图表，请点击右上角添加。
          </div>
        )
      )}
    </div>
  );
};
