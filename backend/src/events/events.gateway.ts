import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventsService } from './events.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly eventsService: EventsService) {}

  afterInit(server: Server) {
    this.eventsService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Client joins a kitchen station room to receive only relevant events
  @SubscribeMessage('join:station')
  handleJoinStation(
    @MessageBody() station: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `station:${station.toUpperCase()}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined station room: ${room}`);
    return { joined: room };
  }

  // Client joins an order room to track their order status (customer QR)
  @SubscribeMessage('join:order')
  handleJoinOrder(
    @MessageBody() orderId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `order:${orderId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} watching order: ${orderId}`);
    return { joined: room };
  }

  // Client joins the approval hub room
  @SubscribeMessage('join:approval')
  handleJoinApproval(@ConnectedSocket() client: Socket) {
    client.join('approval:hub');
    return { joined: 'approval:hub' };
  }

  // Client joins the POS room
  @SubscribeMessage('join:pos')
  handleJoinPOS(@ConnectedSocket() client: Socket) {
    client.join('pos:all');
    return { joined: 'pos:all' };
  }
}
