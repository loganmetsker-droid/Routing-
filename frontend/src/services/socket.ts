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
