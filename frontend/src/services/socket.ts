/**
 * Socket.IO client configuration for real-time tracking
 */
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
)
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

// Tracking namespace socket
let trackingSocket: Socket | null = null;

/**
 * Get or create tracking socket connection
 */
export const getTrackingSocket = (): Socket => {
  if (!trackingSocket) {
    trackingSocket = io(`${SOCKET_URL}/tracking`, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    trackingSocket.on('connect', () => {
      console.log('✅ Connected to tracking socket');
    });

    trackingSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from tracking socket:', reason);
    });

    trackingSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  return trackingSocket;
};

/**
 * Disconnect tracking socket
 */
export const disconnectTrackingSocket = () => {
  if (trackingSocket) {
    trackingSocket.disconnect();
    trackingSocket = null;
  }
};

// Dispatch namespace socket (optional)
let dispatchSocket: Socket | null = null;

/**
 * Get or create dispatch socket connection
 */
export const getDispatchSocket = (): Socket => {
  if (!dispatchSocket) {
    dispatchSocket = io(`${SOCKET_URL}/dispatch`, {
      autoConnect: true,
      reconnection: true,
    });

    dispatchSocket.on('connect', () => {
      console.log('✅ Connected to dispatch socket');
    });

    dispatchSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from dispatch socket:', reason);
    });
  }

  return dispatchSocket;
};

/**
 * Disconnect dispatch socket
 */
export const disconnectDispatchSocket = () => {
  if (dispatchSocket) {
    dispatchSocket.disconnect();
    dispatchSocket = null;
  }
};

/**
 * Dispatch realtime adapter that normalizes Socket.IO events
 * into the SSE-style payloads used throughout the UI.
 */
export const connectDispatchRealtime = (onMessage: (data: any) => void) => {
  const socket = getDispatchSocket();
  const recent = new Map<string, number>();
  const DEDUPE_MS = 500;

  const shouldEmit = (type: string, payload: any) => {
    const routeId = payload?.routeId || payload?.route?.id || payload?.id || 'unknown';
    const key = `${type}:${routeId}`;
    const now = Date.now();
    const last = recent.get(key) || 0;
    if (now - last < DEDUPE_MS) return false;
    recent.set(key, now);
    return true;
  };

  const emitNormalized = (type: string, payload: any) => {
    if (!shouldEmit(type, payload)) return;
    const route = payload?.route || payload;
    onMessage({ type, route, raw: payload });
  };

  const emitSyntheticJobUpdate = (payload: any) => {
    if (!shouldEmit('job-updated', payload)) return;
    const route = payload?.route || payload;
    onMessage({ type: 'job-updated', route, raw: payload });
  };

  const handleRouteUpdate = (payload: any) => {
    const normalizedType =
      payload?.type === 'created' ? 'route-created' : 'route-updated';
    emitNormalized(normalizedType, payload);
    emitSyntheticJobUpdate(payload);
  };

  const handleRouteCreated = (payload: any) => emitNormalized('route-created', payload);
  const handleRouteUpdated = (payload: any) => {
    emitNormalized('route-updated', payload);
    emitSyntheticJobUpdate(payload);
  };
  const handleRouteStarted = (payload: any) => {
    emitNormalized('route-updated', payload);
    emitSyntheticJobUpdate(payload);
  };
  const handleRouteCompleted = (payload: any) => {
    emitNormalized('route-updated', payload);
    emitSyntheticJobUpdate(payload);
  };
  const handleRouteCancelled = (payload: any) => {
    emitNormalized('route-updated', payload);
    emitSyntheticJobUpdate(payload);
  };

  socket.on('route:update', handleRouteUpdate);
  socket.on('route:created', handleRouteCreated);
  socket.on('route:updated', handleRouteUpdated);
  socket.on('route:started', handleRouteStarted);
  socket.on('route:completed', handleRouteCompleted);
  socket.on('route:cancelled', handleRouteCancelled);

  return {
    close: () => {
      socket.off('route:update', handleRouteUpdate);
      socket.off('route:created', handleRouteCreated);
      socket.off('route:updated', handleRouteUpdated);
      socket.off('route:started', handleRouteStarted);
      socket.off('route:completed', handleRouteCompleted);
      socket.off('route:cancelled', handleRouteCancelled);
    },
  };
};
