import React, { useState } from 'react';
import { useStore } from '../store';
import { PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

export const ModuleTable: React.FC = () => {
  const { modules, user, deleteModule, createModule, updateModule } = useStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);

  const isAdmin = user?.is_superuser;

  const handleEdit = (mod: any) => {
    setEditingId(mod.id);
    setEditForm({ ...mod });
  };

  const handleSave = async (id: number) => {
    await updateModule(id, editForm);
    setEditingId(null);
  };

  const handleAddSave = async () => {
    await createModule(editForm);
    setIsAdding(false);
    setEditForm({});
  };

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 shadow-lg overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-dark-700">
        <h3 className="text-lg font-semibold text-white">模组数据库</h3>
        {isAdmin && !isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setEditForm({}); }}
            className="flex items-center gap-2 rounded bg-primary-500 px-3 py-1 text-sm font-medium text-white hover:bg-primary-400"
          >
            <PlusIcon className="h-4 w-4" /> 添加模组
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-dark-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-6 py-3 whitespace-nowrap">名称</th>
              <th className="px-6 py-3 whitespace-nowrap">制造商</th>
              <th className="px-6 py-3 whitespace-nowrap">峰值扭矩 (Nm)</th>
              <th className="px-6 py-3 whitespace-nowrap">额定扭矩 (Nm)</th>
              <th className="px-6 py-3 whitespace-nowrap">启停扭矩 (Nm)</th>
              <th className="px-6 py-3 whitespace-nowrap">堵转扭矩 (Nm)</th>
              <th className="px-6 py-3 whitespace-nowrap">峰值转速 (rpm)</th>
              <th className="px-6 py-3 whitespace-nowrap">额定转速 (rpm)</th>
              <th className="px-6 py-3 whitespace-nowrap">峰值扭矩密度 (Nm/kg)</th>
              <th className="px-6 py-3 whitespace-nowrap">额定扭矩密度 (Nm/kg)</th>
              <th className="px-6 py-3 whitespace-nowrap">响应时间 (ms)</th>
              <th className="px-6 py-3 whitespace-nowrap">转速波动 (%)</th>
              <th className="px-6 py-3 whitespace-nowrap">转矩波动 (%)</th>
              <th className="px-6 py-3 whitespace-nowrap">1.5x过载时间 (s)</th>
              <th className="px-6 py-3 whitespace-nowrap">2x过载时间 (s)</th>
              <th className="px-6 py-3 whitespace-nowrap">2.5x过载时间 (s)</th>
              <th className="px-6 py-3 whitespace-nowrap">3x过载时间 (s)</th>
              <th className="px-6 py-3 whitespace-nowrap">重量 (kg)</th>
              <th className="px-6 py-3 whitespace-nowrap">执行器外径 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">中空直径 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">轴向长度 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">定子内径 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">定子外径 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">转子内径 (mm)</th>
              <th className="px-6 py-3 whitespace-nowrap">转子外径 (mm)</th>
              {isAdmin && <th className="px-6 py-3 text-right whitespace-nowrap sticky right-0 bg-dark-900 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)]">操作</th>}
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-b border-dark-700 bg-dark-800">
                <td className="px-6 py-4"><input className="w-24 bg-dark-900 px-2 py-1 rounded" placeholder="名称" onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                <td className="px-6 py-4"><input className="w-24 bg-dark-900 px-2 py-1 rounded" placeholder="制造商" onChange={e => setEditForm({...editForm, manufacturer: e.target.value})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="峰值" onChange={e => setEditForm({...editForm, peak_torque: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="额定" onChange={e => setEditForm({...editForm, nominal_torque: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="启停" onChange={e => setEditForm({...editForm, start_stop_torque: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="堵转" onChange={e => setEditForm({...editForm, stall_torque: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="峰值转速" onChange={e => setEditForm({...editForm, peak_speed: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="额定转速" onChange={e => setEditForm({...editForm, nominal_speed: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4 text-slate-500 bg-dark-900/50 rounded">-</td>
                <td className="px-6 py-4 text-slate-500 bg-dark-900/50 rounded">-</td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="响应" onChange={e => setEditForm({...editForm, response_time: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="转速波动" onChange={e => setEditForm({...editForm, speed_fluctuation: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="转矩波动" onChange={e => setEditForm({...editForm, torque_fluctuation: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="1.5x" onChange={e => setEditForm({...editForm, overload_time_1_5x: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="2x" onChange={e => setEditForm({...editForm, overload_time_2x: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="2.5x" onChange={e => setEditForm({...editForm, overload_time_2_5x: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="3x" onChange={e => setEditForm({...editForm, overload_time_3x: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="重量" onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="外径" onChange={e => setEditForm({...editForm, actuator_outer_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="中空直径" onChange={e => setEditForm({...editForm, actuator_hollow_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="轴向长度" onChange={e => setEditForm({...editForm, actuator_axial_length: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="定子内径" onChange={e => setEditForm({...editForm, stator_inner_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="定子外径" onChange={e => setEditForm({...editForm, stator_outer_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="转子内径" onChange={e => setEditForm({...editForm, rotor_inner_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4"><input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" placeholder="转子外径" onChange={e => setEditForm({...editForm, rotor_outer_diameter: parseFloat(e.target.value)})} /></td>
                <td className="px-6 py-4 text-right sticky right-0 bg-dark-800 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)]">
                  <button onClick={handleAddSave} className="text-green-500 hover:text-green-400 mr-3">保存</button>
                  <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-300">取消</button>
                </td>
              </tr>
            )}
            {modules.map((mod) => (
              <tr key={mod.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                  {editingId === mod.id ? 
                    <input className="w-24 bg-dark-900 px-2 py-1 rounded" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                    : mod.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === mod.id ? 
                    <input className="w-24 bg-dark-900 px-2 py-1 rounded" value={editForm.manufacturer || ''} onChange={e => setEditForm({...editForm, manufacturer: e.target.value})} />
                    : mod.manufacturer}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.peak_torque ?? ''} onChange={e => setEditForm({...editForm, peak_torque: parseFloat(e.target.value)})} />
                    : mod.peak_torque}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.nominal_torque ?? ''} onChange={e => setEditForm({...editForm, nominal_torque: parseFloat(e.target.value)})} />
                    : mod.nominal_torque}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.start_stop_torque ?? ''} onChange={e => setEditForm({...editForm, start_stop_torque: parseFloat(e.target.value)})} />
                    : mod.start_stop_torque}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.stall_torque ?? ''} onChange={e => setEditForm({...editForm, stall_torque: parseFloat(e.target.value)})} />
                    : mod.stall_torque}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.peak_speed ?? ''} onChange={e => setEditForm({...editForm, peak_speed: parseFloat(e.target.value)})} />
                    : mod.peak_speed}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.nominal_speed ?? ''} onChange={e => setEditForm({...editForm, nominal_speed: parseFloat(e.target.value)})} />
                    : mod.nominal_speed}
                </td>
                <td className="px-6 py-4 text-primary-400 font-medium">
                  {mod.weight && mod.peak_torque ? (mod.peak_torque / mod.weight).toFixed(2) : '-'}
                </td>
                <td className="px-6 py-4 text-primary-400 font-medium">
                  {mod.weight && mod.nominal_torque ? (mod.nominal_torque / mod.weight).toFixed(2) : '-'}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.response_time ?? ''} onChange={e => setEditForm({...editForm, response_time: parseFloat(e.target.value)})} />
                    : mod.response_time}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.speed_fluctuation ?? ''} onChange={e => setEditForm({...editForm, speed_fluctuation: parseFloat(e.target.value)})} />
                    : mod.speed_fluctuation}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.torque_fluctuation ?? ''} onChange={e => setEditForm({...editForm, torque_fluctuation: parseFloat(e.target.value)})} />
                    : mod.torque_fluctuation}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.overload_time_1_5x ?? ''} onChange={e => setEditForm({...editForm, overload_time_1_5x: parseFloat(e.target.value)})} />
                    : mod.overload_time_1_5x}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.overload_time_2x ?? ''} onChange={e => setEditForm({...editForm, overload_time_2x: parseFloat(e.target.value)})} />
                    : mod.overload_time_2x}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.overload_time_2_5x ?? ''} onChange={e => setEditForm({...editForm, overload_time_2_5x: parseFloat(e.target.value)})} />
                    : mod.overload_time_2_5x}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.overload_time_3x ?? ''} onChange={e => setEditForm({...editForm, overload_time_3x: parseFloat(e.target.value)})} />
                    : mod.overload_time_3x}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.weight ?? ''} onChange={e => setEditForm({...editForm, weight: parseFloat(e.target.value)})} />
                    : mod.weight}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.actuator_outer_diameter ?? ''} onChange={e => setEditForm({...editForm, actuator_outer_diameter: parseFloat(e.target.value)})} />
                    : mod.actuator_outer_diameter}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.actuator_hollow_diameter ?? ''} onChange={e => setEditForm({...editForm, actuator_hollow_diameter: parseFloat(e.target.value)})} />
                    : mod.actuator_hollow_diameter}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.actuator_axial_length ?? ''} onChange={e => setEditForm({...editForm, actuator_axial_length: parseFloat(e.target.value)})} />
                    : mod.actuator_axial_length}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.stator_inner_diameter ?? ''} onChange={e => setEditForm({...editForm, stator_inner_diameter: parseFloat(e.target.value)})} />
                    : mod.stator_inner_diameter}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.stator_outer_diameter ?? ''} onChange={e => setEditForm({...editForm, stator_outer_diameter: parseFloat(e.target.value)})} />
                    : mod.stator_outer_diameter}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.rotor_inner_diameter ?? ''} onChange={e => setEditForm({...editForm, rotor_inner_diameter: parseFloat(e.target.value)})} />
                    : mod.rotor_inner_diameter}
                </td>
                <td className="px-6 py-4">
                  {editingId === mod.id ? 
                    <input className="w-16 bg-dark-900 px-2 py-1 rounded" type="number" step="0.1" value={editForm.rotor_outer_diameter ?? ''} onChange={e => setEditForm({...editForm, rotor_outer_diameter: parseFloat(e.target.value)})} />
                    : mod.rotor_outer_diameter}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right sticky right-0 bg-dark-800 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.3)]">
                    {editingId === mod.id ? (
                      <>
                        <button onClick={() => handleSave(mod.id)} className="text-green-500 hover:text-green-400 mr-3">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-300">取消</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(mod)} className="text-blue-500 hover:text-blue-400 mr-3">
                          <PencilSquareIcon className="h-5 w-5 inline" />
                        </button>
                        <button onClick={() => deleteModule(mod.id)} className="text-red-500 hover:text-red-400">
                          <TrashIcon className="h-5 w-5 inline" />
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
