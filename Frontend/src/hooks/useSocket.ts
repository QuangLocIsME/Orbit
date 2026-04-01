/**
 * useSocket — React hook that provides the singleton socket and connection state.
 *
 * Example:
 *   const { socket, connected } = useSocket();
 *   useEffect(() => {
 *     socket.on('notification:new', handler);
 *     return () => { socket.off('notification:new', handler); };
 *   }, [socket]);
 */

import { useEffect, useState } from 'react';
import { getSocket, type OrbitSocket } from '@/lib/socket';
import { isAuthenticated } from '@/lib/auth';

interface UseSocketReturn {
  socket: OrbitSocket | null;
  connected: boolean;
  latency: number | null;
}

export function useSocket(): UseSocketReturn {
  const [connected, setConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [socket, setSocket] = useState<OrbitSocket | null>(null);

  useEffect(() => {
    // Only connect if the user is authenticated
    if (!isAuthenticated()) return;

    const s = getSocket();
    setSocket(s);
    setConnected(s.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Measure latency every 30 seconds
    let latencyInterval: ReturnType<typeof setInterval>;

    if (s.connected) {
      measureAndSet(s, setLatency);
    }

    s.on('connect', () => {
      measureAndSet(s, setLatency);
      latencyInterval = setInterval(() => measureAndSet(s, setLatency), 30_000);
    });

    s.on('disconnect', () => {
      clearInterval(latencyInterval);
      setLatency(null);
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      clearInterval(latencyInterval);
    };
  }, []);

  return { socket, connected, latency };
}

function measureAndSet(
  s: OrbitSocket,
  setLatency: (ms: number) => void
) {
  const start = Date.now();
  s.emit('ping', () => {
    setLatency(Date.now() - start);
  });
}
