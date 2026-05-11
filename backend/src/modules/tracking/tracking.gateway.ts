import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { TrackingService, VehicleLocation } from './tracking.service';
import { createCorsOriginValidator } from '../../common/http/cors-origin.util';
import {
  authenticateSocket,
  getSocketAuth,
  socketOrganizationRoom,
} from '../../common/websocket/socket-auth.util';

/**
 * WebSocket Gateway for real-time vehicle tracking
 */
@WebSocketGateway({
  cors: {
    origin: createCorsOriginValidator(),
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private connectedClients = new Map<string, string>();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly jwtService: JwtService,
    @InjectRepository(AuthSession)
    private readonly authSessions: Repository<AuthSession>,
  ) {}

  private emitToOrganization(
    organizationId: string,
    event: string,
    payload: Record<string, unknown>,
    channel?: string,
  ) {
    const room = socketOrganizationRoom('tracking', organizationId, channel);
    this.server.to(room).emit(event, { ...payload, organizationId });
  }

  private organizationIdsWithClients() {
    return Array.from(new Set(this.connectedClients.values()));
  }

  /**
   * Gateway initialization
   */
  afterInit(server: Server) {
    this.logger.log('🚀 Tracking WebSocket Gateway initialized');
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    let organizationId: string;
    try {
      const auth = await authenticateSocket(
        this.jwtService,
        client,
        this.authSessions,
      );
      client.data.auth = auth;
      organizationId = auth.organizationId;
      client.join(socketOrganizationRoom('tracking', organizationId));
      this.connectedClients.set(client.id, organizationId);
      this.logger.log(`Client connected: ${client.id} org=${organizationId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rejected tracking socket ${client.id}: ${message}`);
      client.emit('error', { message: 'Unauthorized socket connection' });
      client.disconnect(true);
      return;
    }

    try {
      // Send current vehicle locations immediately on connect
      const locations = await this.trackingService.getLatestVehicleLocations({
        organizationId,
      });

      client.emit('vehicle:locations', {
        vehicles: locations,
        timestamp: new Date().toISOString(),
        count: locations.length,
        organizationId,
      });

      this.logger.log(
        `Sent ${locations.length} vehicle locations to client ${client.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending initial locations to client ${client.id}: ${error.message}`,
      );
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Subscribe to vehicle location updates
   */
  @SubscribeMessage('subscribe:locations')
  handleSubscribeLocations(@ConnectedSocket() client: Socket) {
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    this.logger.log(
      `Client ${client.id} subscribed to location updates org=${auth.organizationId}`,
    );
    client.join(
      socketOrganizationRoom('tracking', auth.organizationId, 'locations'),
    );
    return {
      event: 'subscribed',
      data: {
        room: 'locations',
        updateInterval: 30000, // 30 seconds
      },
    };
  }

  /**
   * Get location history for specific vehicle
   */
  @SubscribeMessage('get:vehicle-history')
  async handleGetVehicleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; hours?: number },
  ) {
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    this.logger.log(
      `Client ${client.id} requested history for vehicle ${data.vehicleId} org=${auth.organizationId}`,
    );

    try {
      const history = await this.trackingService.getVehicleLocationHistory(
        data.vehicleId,
        data.hours || 24,
        auth.organizationId,
      );

      return {
        event: 'vehicle:history',
        data: {
          vehicleId: data.vehicleId,
          history,
          count: history.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching vehicle history: ${error.message}`,
        error.stack,
      );
      return {
        event: 'error',
        data: {
          message: 'Failed to fetch vehicle history',
          error: error.message,
        },
      };
    }
  }

  /**
   * Broadcast vehicle locations to all connected clients every 30 seconds
   */
  @Interval(30000) // 30 seconds
  async broadcastVehicleLocations() {
    if (this.connectedClients.size === 0) {
      this.logger.debug('No connected clients, skipping location broadcast');
      return;
    }

    try {
      this.logger.debug(
        `Broadcasting vehicle locations to ${this.connectedClients.size} clients`,
      );

      for (const organizationId of this.organizationIdsWithClients()) {
        const locations = await this.trackingService.getLatestVehicleLocations({
          organizationId,
        });
        const payload = {
          vehicles: locations,
          timestamp: new Date().toISOString(),
          count: locations.length,
        };
        this.emitToOrganization(
          organizationId,
          'vehicle:locations',
          payload,
          'locations',
        );
        this.emitToOrganization(organizationId, 'vehicle:locations', payload);
      }

      this.logger.debug(
        `Broadcast vehicle locations for ${this.organizationIdsWithClients().length} organizations`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting vehicle locations: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually trigger location broadcast (for testing)
   */
  async triggerLocationBroadcast() {
    this.logger.log('🔧 Manual location broadcast triggered');
    await this.broadcastVehicleLocations();
  }

  /**
   * Emit single vehicle location update
   */
  emitVehicleLocationUpdate(vehicleLocation: VehicleLocation) {
    const organizationId =
      typeof (vehicleLocation as any).organizationId === 'string'
        ? (vehicleLocation as any).organizationId
        : null;
    if (!organizationId) {
      this.logger.warn(
        `Skipping vehicle location broadcast for ${vehicleLocation.vehicleId}: missing organization scope`,
      );
      return;
    }
    this.emitToOrganization(
      organizationId,
      'vehicle:location-update',
      vehicleLocation as any,
    );
  }

  /**
   * Get tracking statistics
   */
  @SubscribeMessage('get:statistics')
  async handleGetStatistics(@ConnectedSocket() client: Socket) {
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    try {
      const stats = await this.trackingService.getStatistics(auth.organizationId);
      return {
        event: 'tracking:statistics',
        data: { ...stats, organizationId: auth.organizationId },
      };
    } catch (error) {
      this.logger.error(`Error fetching statistics: ${error.message}`);
      return {
        event: 'error',
        data: { message: 'Failed to fetch statistics' },
      };
    }
  }

  /**
   * Broadcast route update to all connected clients
   * Called when routes are created, updated, or dispatched
   */
  broadcastRouteUpdate(route: any, eventType: 'created' | 'updated' | 'dispatched' | 'completed') {
    const organizationId =
      typeof route?.organizationId === 'string' ? route.organizationId : null;
    if (!organizationId) {
      this.logger.warn(
        `Skipping route ${eventType} broadcast for ${route?.id || 'unknown'}: missing organization scope`,
      );
      return;
    }
    this.logger.log(`Broadcasting route ${eventType}: ${route.id}`);
    this.emitToOrganization(organizationId, 'route:update', {
      type: eventType,
      route,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle driver GPS location updates from mobile app
   */
  @SubscribeMessage('driver:location')
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      vehicleId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      timestamp: string;
    },
  ) {
    const auth = getSocketAuth(client);
    if (!auth) {
      return { event: 'error', data: { message: 'Unauthorized' } };
    }
    try {
      this.logger.log(
        `Received location update for vehicle ${data.vehicleId} from client ${client.id} org=${auth.organizationId}`,
      );

      // Validate data
      if (
        !data.vehicleId ||
        typeof data.lat !== 'number' ||
        Number.isNaN(data.lat) ||
        typeof data.lng !== 'number' ||
        Number.isNaN(data.lng)
      ) {
        return {
          event: 'error',
          data: { message: 'Missing required fields: vehicleId, lat, lng' },
        };
      }

      const persisted = await this.trackingService.ingestTelemetry({
        vehicleId: data.vehicleId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        timestamp: data.timestamp,
        organizationId: auth.organizationId,
      }, auth);

      this.emitToOrganization(auth.organizationId, 'vehicle:location-update', {
        vehicleId: persisted.vehicleId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        timestamp: persisted.timestamp,
      });

      this.logger.log(
        `✅ Location updated for vehicle ${persisted.vehicleId} and broadcast to clients`,
      );

      return {
        event: 'location:acknowledged',
        data: {
          vehicleId: persisted.vehicleId,
          timestamp: persisted.timestamp,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error handling driver location: ${error.message}`,
        error.stack,
      );
      return {
        event: 'error',
        data: { message: 'Failed to update location' },
      };
    }
  }
}
