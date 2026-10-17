import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export const SocketEvent = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_APPROVED: 'ORDER_APPROVED',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ORDER_FIRED: 'ORDER_FIRED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ITEM_COOKING: 'ITEM_COOKING',
  ITEM_READY: 'ITEM_READY',
  ITEM_SERVED: 'ITEM_SERVED',
  TABLE_UPDATED: 'TABLE_UPDATED',
  KITCHEN_ALERT: 'KITCHEN_ALERT',
} as const;
