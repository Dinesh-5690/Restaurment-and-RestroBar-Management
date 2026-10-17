'use client';
import { useEffect, useRef } from 'react';
import { getSocket, SocketEvent } from '../lib/socket';
import type { Socket } from 'socket.io-client';

type EventKey = keyof typeof SocketEvent;

export function useSocket(
  handlers: Partial<Record<EventKey, (data: any) => void>>,
  rooms?: string[],
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Join rooms
    if (rooms) {
      rooms.forEach((room) => {
        if (room.startsWith('station:')) socket.emit('join:station', room.replace('station:', ''));
        else if (room.startsWith('order:')) socket.emit('join:order', room.replace('order:', ''));
        else if (room === 'approval:hub') socket.emit('join:approval');
        else if (room === 'pos:all') socket.emit('join:pos');
      });
    }

    // Register handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      if (handler) socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [rooms, handlers]);

  return socketRef.current;
}
