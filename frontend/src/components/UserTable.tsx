import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

export const UserTable: React.FC = () => {
  const { users, fetchUsers, deleteUser, createUser, updateUser, user: currentUser } = useStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (u: any) => {
    setEditingId(u.id);
    setEditForm({ username: u.username, is_active: u.is_active, is_superuser: u.is_superuser });
  };

  const handleSave = async (id: number) => {
    try {
      await updateUser(id, editForm);
      setEditingId(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || '保存失败');
    }
  };

  const handleAddSave = async () => {
    if (!editForm.password) {
      alert('密码不能为空');
      return;
    }
    try {
      await createUser(editForm);
      setIsAdding(false);
      setEditForm({});
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('确定要删除该用户吗？')) {
      try {
        await deleteUser(id);
      } catch (err: any) {
        alert(err.response?.data?.detail || '删除失败');
      }
    }
  };

  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800 shadow-lg overflow-hidden mt-6">
      <div className="flex justify-between items-center p-4 border-b border-dark-700">
        <h3 className="text-lg font-semibold text-white">用户管理</h3>
        {!isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setEditForm({ is_active: true, is_superuser: false }); }}
            className="flex items-center gap-2 rounded bg-primary-500 px-3 py-1 text-sm font-medium text-white hover:bg-primary-400"
          >
            <PlusIcon className="h-4 w-4" /> 添加用户
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-dark-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">用户名</th>
              <th className="px-6 py-3">角色</th>
              <th className="px-6 py-3">状态</th>
              <th className="px-6 py-3">密码</th>
              <th className="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-b border-dark-700 bg-dark-800">
                <td className="px-6 py-4">-</td>
                <td className="px-6 py-4"><input className="w-24 bg-dark-900 px-2 py-1 rounded" placeholder="用户名" onChange={e => setEditForm({...editForm, username: e.target.value})} /></td>
                <td className="px-6 py-4">
                  <select className="bg-dark-900 px-2 py-1 rounded" value={editForm.is_superuser ? 'admin' : 'user'} onChange={e => setEditForm({...editForm, is_superuser: e.target.value === 'admin'})}>
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select className="bg-dark-900 px-2 py-1 rounded" value={editForm.is_active ? 'active' : 'inactive'} onChange={e => setEditForm({...editForm, is_active: e.target.value === 'active'})}>
                    <option value="active">活跃</option>
                    <option value="inactive">禁用</option>
                  </select>
                </td>
                <td className="px-6 py-4"><input className="w-24 bg-dark-900 px-2 py-1 rounded" type="password" placeholder="输入密码" onChange={e => setEditForm({...editForm, password: e.target.value})} /></td>
                <td className="px-6 py-4 text-right">
                  <button onClick={handleAddSave} className="text-green-500 hover:text-green-400 mr-3">保存</button>
                  <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-300">取消</button>
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                <td className="px-6 py-4">{u.id}</td>
                <td className="px-6 py-4 font-medium text-white">
                  {editingId === u.id ? 
                    <input className="w-24 bg-dark-900 px-2 py-1 rounded" value={editForm.username || ''} onChange={e => setEditForm({...editForm, username: e.target.value})} />
                    : u.username}
                </td>
                <td className="px-6 py-4">
                  {editingId === u.id ? 
                    <select className="bg-dark-900 px-2 py-1 rounded" value={editForm.is_superuser ? 'admin' : 'user'} onChange={e => setEditForm({...editForm, is_superuser: e.target.value === 'admin'})}>
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                    : (u.is_superuser ? <span className="text-primary-400">管理员</span> : '普通用户')}
                </td>
                <td className="px-6 py-4">
                  {editingId === u.id ? 
                    <select className="bg-dark-900 px-2 py-1 rounded" value={editForm.is_active ? 'active' : 'inactive'} onChange={e => setEditForm({...editForm, is_active: e.target.value === 'active'})}>
                      <option value="active">活跃</option>
                      <option value="inactive">禁用</option>
                    </select>
                    : (u.is_active ? <span className="text-green-400">活跃</span> : <span className="text-red-400">禁用</span>)}
                </td>
                <td className="px-6 py-4">
                  {editingId === u.id ? 
                    <input className="w-24 bg-dark-900 px-2 py-1 rounded" type="password" placeholder="不填则不修改" onChange={e => setEditForm({...editForm, password: e.target.value})} />
                    : '********'}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === u.id ? (
                    <>
                      <button onClick={() => handleSave(u.id)} className="text-green-500 hover:text-green-400 mr-3">保存</button>
                      <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-300">取消</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEdit(u)} className="text-blue-500 hover:text-blue-400 mr-3">
                        <PencilSquareIcon className="h-5 w-5 inline" />
                      </button>
                      {currentUser?.id !== u.id && (
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-400">
                          <TrashIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
