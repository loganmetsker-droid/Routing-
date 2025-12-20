import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Route } from './entities/route.entity';

/**
 * WebSocket Gateway for real-time dispatch updates
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure appropriately for production
    credentials: true,
  },
  namespace: '/dispatch',
})
export class DispatchGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DispatchGateway.name);

  /**
   * Handle client connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to route updates
   */
  @SubscribeMessage('subscribe:routes')
  handleSubscribeRoutes(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to route updates`);
    client.join('routes');
    return { event: 'subscribed', data: 'routes' };
  }

  /**
   * Subscribe to vehicle updates
   */
  @SubscribeMessage('subscribe:vehicles')
  handleSubscribeVehicles(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to vehicle updates`);
    client.join('vehicles');
    return { event: 'subscribed', data: 'vehicles' };
  }

  /**
   * Emit route created event
   */
  emitRouteCreated(route: Route) {
    this.logger.log(`Emitting route created: ${route.id}`);
    this.server.to('routes').emit('route:created', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      jobCount: route.jobCount,
      status: route.status,
      totalDistanceKm: route.totalDistanceKm,
      totalDurationMinutes: route.totalDurationMinutes,
      createdAt: route.createdAt,
    });
  }

  /**
   * Emit route started event
   */
  emitRouteStarted(route: Route) {
    this.logger.log(`Emitting route started: ${route.id}`);
    this.server.to('routes').emit('route:started', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      status: route.status,
      actualStart: route.actualStart,
    });
  }

  /**
   * Emit route completed event
   */
  emitRouteCompleted(route: Route) {
    this.logger.log(`Emitting route completed: ${route.id}`);
    this.server.to('routes').emit('route:completed', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      status: route.status,
      completedAt: route.completedAt,
    });
  }

  /**
   * Emit vehicle status update
   */
  emitVehicleStatusUpdate(update: {
    vehicleId: string;
    status: string;
    routeId?: string;
  }) {
    this.logger.log(`Emitting vehicle status update: ${update.vehicleId}`);
    this.server.to('vehicles').emit('vehicle:status-update', update);
  }

  /**
   * Emit job assigned event
   */
  emitJobAssigned(jobId: string, routeId: string) {
    this.logger.log(`Emitting job assigned: ${jobId} to route ${routeId}`);
    this.server.emit('job:assigned', {
      jobId,
      routeId,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast generic dispatch event
   */
  broadcastDispatchEvent(event: string, data: any) {
    this.logger.log(`Broadcasting dispatch event: ${event}`);
    this.server.emit(event, data);
  }
}
