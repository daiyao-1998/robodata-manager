import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Charts } from '../components/Charts';
import { ModuleTable } from '../components/ModuleTable';
import { UserTable } from '../components/UserTable';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user, fetchModules, setToken } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'modules' | 'users'>('modules');

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useWebSocket();

  const handleLogout = () => {
    setToken(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-dark-900 text-slate-200">
      <header className="sticky top-0 z-50 border-b border-dark-700 bg-dark-800/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold tracking-wider text-white">机器人<span className="text-primary-500">模组数据</span></h1>
            {user?.is_superuser && (
              <nav className="hidden sm:flex gap-4">
                <button 
                  onClick={() => setActiveTab('modules')}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${activeTab === 'modules' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'}`}
                >
                  模组管理
                </button>
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${activeTab === 'users' ? 'bg-primary-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-dark-700'}`}
                >
                  用户管理
                </button>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              欢迎, <span className="font-semibold text-white">{user?.username}</span>
              {user?.is_superuser && <span className="ml-2 rounded bg-primary-500/20 px-2 py-0.5 text-xs text-primary-400">管理员</span>}
            </span>
            <button onClick={handleLogout} className="rounded border border-dark-600 px-3 py-1 text-sm transition hover:bg-dark-700 text-white">
              注销
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {activeTab === 'modules' ? (
          <>
            <Charts />
            <ModuleTable />
          </>
        ) : (
          <UserTable />
        )}
      </main>
    </div>
  );
};
