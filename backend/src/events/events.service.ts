import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketEvent } from '../common/enums';

@Injectable()
export class EventsService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emit(event: SocketEvent, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
    }
  }

  emitToRoom(room: string, event: SocketEvent, payload: any) {
    if (this.server) {
      this.server.to(room).emit(event, payload);
    }
  }

  // Send event to specific kitchen station room
  emitToStation(station: string, event: SocketEvent, payload: any) {
    this.emitToRoom(`station:${station.toUpperCase()}`, event, payload);
  }

  // Send event to order watchers (e.g., customer QR status screen)
  emitToOrder(orderId: string, event: SocketEvent, payload: any) {
    this.emitToRoom(`order:${orderId}`, event, payload);
  }
}
