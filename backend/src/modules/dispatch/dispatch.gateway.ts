import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Route } from './entities/route.entity';
import { createCorsOriginValidator } from '../../common/http/cors-origin.util';
import {
  authenticateSocket,
  getSocketAuth,
  socketOrganizationRoom,
} from '../../common/websocket/socket-auth.util';

/**
 * WebSocket Gateway for real-time dispatch updates
 */
@WebSocketGateway({
  cors: {
    origin: createCorsOriginValidator(),
    credentials: true,
  },
  namespace: '/dispatch',
})
export class DispatchGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DispatchGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  private emitToOrganization(
    organizationId: string,
    event: string,
    payload: Record<string, unknown>,
    channel?: string,
  ) {
    const room = socketOrganizationRoom('dispatch', organizationId, channel);
    this.server.to(room).emit(event, { ...payload, organizationId });
  }

  private routeOrganizationId(route: Route, event: string) {
    if (!route.organizationId) {
      this.logger.warn(
        `Skipping ${event} broadcast for route ${route.id}: missing organization scope`,
      );
      return null;
    }
    return route.organizationId;
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    try {
      const auth = await authenticateSocket(this.jwtService, client);
      client.data.auth = auth;
      client.join(socketOrganizationRoom('dispatch', auth.organizationId));
      this.logger.log(
        `Client connected: ${client.id} org=${auth.organizationId}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rejected dispatch socket ${client.id}: ${message}`);
      client.emit('error', { message: 'Unauthorized socket connection' });
      client.disconnect(true);
    }
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
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    const room = socketOrganizationRoom('dispatch', auth.organizationId, 'routes');
    this.logger.log(
      `Client ${client.id} subscribed to route updates org=${auth.organizationId}`,
    );
    client.join(room);
    return { event: 'subscribed', data: { room: 'routes' } };
  }

  /**
   * Subscribe to vehicle updates
   */
  @SubscribeMessage('subscribe:vehicles')
  handleSubscribeVehicles(@ConnectedSocket() client: Socket) {
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    const room = socketOrganizationRoom('dispatch', auth.organizationId, 'vehicles');
    this.logger.log(
      `Client ${client.id} subscribed to vehicle updates org=${auth.organizationId}`,
    );
    client.join(room);
    return { event: 'subscribed', data: { room: 'vehicles' } };
  }

  /**
   * Emit route created event
   */
  emitRouteCreated(route: Route) {
    const organizationId = this.routeOrganizationId(route, 'route:created');
    if (!organizationId) return;
    this.logger.log(`Emitting route created: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:created', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      driverId: route.driverId,
      jobIds: route.jobIds,
      jobCount: route.jobCount,
      status: route.status,
      totalDistanceKm: route.totalDistanceKm,
      totalDurationMinutes: route.totalDurationMinutes,
      polyline: route.polyline,
      color: route.color,
      eta: route.eta,
      createdAt: route.createdAt,
    }, 'routes');

    this.emitToOrganization(organizationId, 'route:update', {
      type: 'created',
      route: {
        id: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        jobIds: route.jobIds,
        jobCount: route.jobCount,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm,
        totalDurationMinutes: route.totalDurationMinutes,
        polyline: route.polyline,
        color: route.color,
        eta: route.eta,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit route started event
   */
  emitRouteStarted(route: Route) {
    const organizationId = this.routeOrganizationId(route, 'route:started');
    if (!organizationId) return;
    this.logger.log(`Emitting route started: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:started', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      status: route.status,
      actualStart: route.actualStart,
    }, 'routes');

    this.emitToOrganization(organizationId, 'route:update', {
      type: 'started',
      route: {
        id: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        jobIds: route.jobIds,
        jobCount: route.jobCount,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm,
        totalDurationMinutes: route.totalDurationMinutes,
        polyline: route.polyline,
        color: route.color,
        eta: route.eta,
        actualStart: route.actualStart,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit route completed event
   */
  emitRouteCompleted(route: Route) {
    const organizationId = this.routeOrganizationId(route, 'route:completed');
    if (!organizationId) return;
    this.logger.log(`Emitting route completed: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:completed', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      status: route.status,
      completedAt: route.completedAt,
    }, 'routes');

    this.emitToOrganization(organizationId, 'route:update', {
      type: 'completed',
      route: {
        id: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        jobIds: route.jobIds,
        jobCount: route.jobCount,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm,
        totalDurationMinutes: route.totalDurationMinutes,
        polyline: route.polyline,
        color: route.color,
        eta: route.eta,
        completedAt: route.completedAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit route cancelled event
   */
  emitRouteCancelled(route: Route) {
    const organizationId = this.routeOrganizationId(route, 'route:cancelled');
    if (!organizationId) return;
    this.logger.log(`Emitting route cancelled: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:cancelled', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      status: route.status,
      cancelledAt: route.updatedAt,
    }, 'routes');

    this.emitToOrganization(organizationId, 'route:update', {
      type: 'cancelled',
      route: {
        id: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        jobIds: route.jobIds,
        jobCount: route.jobCount,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm,
        totalDurationMinutes: route.totalDurationMinutes,
        polyline: route.polyline,
        color: route.color,
        eta: route.eta,
        cancelledAt: route.updatedAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit route updated event (for stop reordering, etc.)
   */
  emitRouteUpdated(route: Route) {
    const organizationId = this.routeOrganizationId(route, 'route:updated');
    if (!organizationId) return;
    this.logger.log(`Emitting route updated: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:updated', {
      routeId: route.id,
      vehicleId: route.vehicleId,
      driverId: route.driverId,
      jobIds: route.jobIds,
      jobCount: route.jobCount,
      status: route.status,
      totalDistanceKm: route.totalDistanceKm,
      totalDurationMinutes: route.totalDurationMinutes,
      polyline: route.polyline,
      color: route.color,
      eta: route.eta,
      updatedAt: route.updatedAt,
    }, 'routes');

    this.emitToOrganization(organizationId, 'route:update', {
      type: 'updated',
      route: {
        id: route.id,
        vehicleId: route.vehicleId,
        driverId: route.driverId,
        jobIds: route.jobIds,
        jobCount: route.jobCount,
        status: route.status,
        totalDistanceKm: route.totalDistanceKm,
        totalDurationMinutes: route.totalDurationMinutes,
        polyline: route.polyline,
        color: route.color,
        eta: route.eta,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit vehicle status update
   */
  emitVehicleStatusUpdate(update: {
    vehicleId: string;
    status: string;
    routeId?: string;
    organizationId?: string | null;
  }) {
    if (!update.organizationId) {
      this.logger.warn(
        `Skipping vehicle status broadcast for ${update.vehicleId}: missing organization scope`,
      );
      return;
    }
    this.logger.log(`Emitting vehicle status update: ${update.vehicleId}`);
    this.emitToOrganization(
      update.organizationId,
      'vehicle:status-update',
      update,
      'vehicles',
    );
  }

  /**
   * Emit job assigned event
   */
  emitJobAssigned(jobId: string, routeId: string, organizationId?: string | null) {
    if (!organizationId) {
      this.logger.warn(
        `Skipping job assigned broadcast for ${jobId}: missing organization scope`,
      );
      return;
    }
    this.logger.log(`Emitting job assigned: ${jobId} to route ${routeId}`);
    this.emitToOrganization(organizationId, 'job:assigned', {
      jobId,
      routeId,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast generic dispatch event
   */
  broadcastDispatchEvent(event: string, data: any) {
    const organizationId =
      typeof data?.organizationId === 'string' ? data.organizationId : null;
    if (!organizationId) {
      this.logger.warn(
        `Skipping ${event} broadcast: missing organization scope`,
      );
      return;
    }
    this.logger.log(`Broadcasting dispatch event: ${event}`);
    this.emitToOrganization(organizationId, event, data);
  }
}
