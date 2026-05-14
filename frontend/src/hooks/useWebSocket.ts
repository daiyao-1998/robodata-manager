import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export const useWebSocket = () => {
  const fetchModules = useStore(state => state.fetchModules);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: number;

    const connect = () => {
      const apiBaseUrl = import.meta.env.VITE_API_URL;
      let wsUrl = '';
      
      if (apiBaseUrl) {
        const wsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
        wsUrl = `${wsBaseUrl}/api/v1/ws`;
      } else {
        wsUrl = `ws://${window.location.hostname}:8000/api/v1/ws`;
      }
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (['create', 'update', 'delete'].includes(data.action)) {
          fetchModules();
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error (will auto-reconnect):', err);
      };

      ws.onclose = () => {
        // 断开后自动重连
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // 防止卸载时触发重连
        wsRef.current.close();
      }
    };
  }, [fetchModules]);
};
