import React, { useState } from 'react';
import { useStore } from '../store';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setToken = useStore(state => state.setToken);
  const fetchUser = useStore(state => state.fetchUser);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const res = await api.post('/users/login', formData);
      setToken(res.data.access_token);
      await fetchUser();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-dark-900">
      <div className="w-full max-w-md rounded-2xl border border-dark-700 bg-dark-800 p-8 shadow-xl">
        <h2 className="mb-6 text-center text-3xl font-bold text-white tracking-wider">机器人<span className="text-primary-500">模组数据</span></h2>
        {error && <div className="mb-4 rounded bg-red-500/20 p-3 text-sm text-red-400">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-400">用户名</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full rounded bg-dark-900 border border-dark-700 px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">密码</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded bg-dark-900 border border-dark-700 px-4 py-2 text-white focus:border-primary-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="w-full rounded bg-primary-500 py-2 font-medium text-white transition hover:bg-primary-400">
            登 录
          </button>
        </form>
      </div>
    </div>
  );
};
