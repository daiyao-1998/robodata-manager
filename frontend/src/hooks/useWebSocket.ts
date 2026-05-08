import { useEffect } from 'react';
import { useStore } from '../store';

export const useWebSocket = () => {
  const fetchModules = useStore(state => state.fetchModules);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_URL;
    let wsUrl = '';
    
    if (apiBaseUrl) {
      // 将 http(s):// 转换为 ws(s)://
      const wsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
      wsUrl = `${wsBaseUrl}/api/v1/ws`;
    } else {
      wsUrl = `ws://${window.location.hostname}:8000/api/v1/ws`;
    }
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['create', 'update', 'delete'].includes(data.action)) {
        fetchModules();
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
    };

    return () => {
      ws.close();
    };
  }, [fetchModules]);
};
