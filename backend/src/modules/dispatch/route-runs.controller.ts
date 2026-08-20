import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { buildAttachmentContentDisposition } from '../../common/http/content-disposition.util';
import { getSafeProofDownloadContentType } from '../../common/files/proof-file.util';
import { RouteRunsService } from './route-runs.service';
import {
  CreateDispatchExceptionDto,
  DispatchRouteRunDto,
  ReassignRouteRunDto,
  RouteRunMessageDto,
  StopNoteDto,
  StopProofDecisionDto,
  StopProofDto,
  StopProofFileDto,
  StopReasonDto,
  UpdateDispatchExceptionDto,
} from './dto/route-run-actions.dto';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    organizationId?: string;
    email?: string;
    roles?: string[];
  };
};

type UploadedProofFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

@ApiTags('dispatch', 'route-runs', 'exceptions')
@Controller()
@ApiBearerAuth('JWT-auth')
export class RouteRunsController {
  constructor(private readonly routeRuns: RouteRunsService) {}

  @Get('dispatch/board')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  board(@Req() req: AuthenticatedRequest) { return this.routeRuns.board(req.user); }

  @Get('route-runs')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  list(@Req() req: AuthenticatedRequest) { return this.routeRuns.list(req.user); }

  @Get('route-runs/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  detail(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.detail(routeId, req.user); }

  @Get('route-runs/:id/messages')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  messages(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) {
    return this.routeRuns.listRouteMessages(routeId, req.user);
  }

  @Post('route-runs/:id/messages')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  createMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') routeId: string,
    @Body() body: RouteRunMessageDto,
  ) {
    return this.routeRuns.createRouteMessage(routeId, body, req.user);
  }

  @Post('route-runs/:id/messages/read')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  markMessagesRead(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) {
    return this.routeRuns.markRouteMessagesRead(routeId, req.user);
  }

  @Post('route-runs/:id/share-link')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  shareLink(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) {
    return this.routeRuns.createPublicTrackingLink(routeId, req.user);
  }

  @Get('driver/manifest')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  manifest(@Req() req: AuthenticatedRequest) {
    return this.routeRuns.getDriverManifest(req.user);
  }

  @Public()
  @Get('public/tracking/:token')
  publicTracking(@Param('token') token: string) {
    return this.routeRuns.getPublicTracking(token);
  }

  @Post('route-runs/:id/dispatch')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  dispatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') routeId: string,
    @Body() body: DispatchRouteRunDto,
  ) {
    return this.routeRuns.dispatchRoute(routeId, body, req.user);
  }

  @Post('route-runs/:id/start')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  start(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.startRoute(routeId, req.user); }

  @Post('route-runs/:id/complete')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  complete(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.completeRoute(routeId, req.user); }

  @Post('route-runs/:id/reassign')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  reassign(
    @Req() req: AuthenticatedRequest,
    @Param('id') routeId: string,
    @Body() body: ReassignRouteRunDto,
  ) {
    return this.routeRuns.reassign(routeId, body, req.user);
  }

  @Get('route-run-stops/:id/timeline')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  timeline(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.getStopTimeline(stopId, req.user); }

  @Get('route-run-stops/:id/proofs')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  proofs(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.getStopProofs(stopId, req.user); }

  @Post('route-run-stops/:id/mark-arrived')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  markArrived(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.markArrived(stopId, req.user); }

  @Post('route-run-stops/:id/serviced')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  serviced(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.markServiced(stopId, req.user); }

  @Post('route-run-stops/:id/failed')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  failed(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: StopReasonDto) { return this.routeRuns.failStop(stopId, body.reason, req.user); }

  @Post('route-run-stops/:id/reschedule')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  reschedule(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: StopReasonDto) { return this.routeRuns.rescheduleStop(stopId, body.reason, req.user); }

  @Post('route-run-stops/:id/proof')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  proof(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: StopProofDto) { return this.routeRuns.addProof(stopId, body, req.user); }

  @Post('route-run-stops/:id/proof-file')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  proofFile(
    @Req() req: AuthenticatedRequest,
    @Param('id') stopId: string,
    @Body() body: StopProofFileDto,
    @UploadedFile() file?: UploadedProofFile,
  ) {
    return this.routeRuns.addProofFile(stopId, body, file, req.user);
  }

  @Post('route-run-stops/:id/proof-decision')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  proofDecision(
    @Req() req: AuthenticatedRequest,
    @Param('id') stopId: string,
    @Body() body: StopProofDecisionDto,
  ) {
    return this.routeRuns.recordProofDecision(stopId, body, req.user);
  }

  @Get('proof-artifacts/:id/download')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  @Header('Cache-Control', 'private, max-age=60')
  async downloadProof(
    @Req() req: AuthenticatedRequest,
    @Param('id') proofId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.routeRuns.getProofArtifactDownload(proofId, req.user);
    response.setHeader('Content-Type', getSafeProofDownloadContentType());
    response.setHeader(
      'Content-Disposition',
      buildAttachmentContentDisposition(file.filename),
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (file.size !== undefined) {
      response.setHeader('Content-Length', String(file.size));
    }
    if (Buffer.isBuffer(file.body)) {
      return new StreamableFile(file.body);
    }
    return new StreamableFile(file.body);
  }

  @Post('route-run-stops/:id/note')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  note(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: StopNoteDto) { return this.routeRuns.addNote(stopId, body.note, req.user); }

  @Get('exceptions')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  exceptions(@Req() req: AuthenticatedRequest) { return this.routeRuns.listExceptions(req.user?.organizationId); }

  @Post('exceptions')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  createException(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateDispatchExceptionDto,
  ) {
    return this.routeRuns.createException(body, req.user);
  }

  @Patch('exceptions/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  updateException(
    @Req() req: AuthenticatedRequest,
    @Param('id') exceptionId: string,
    @Body() body: UpdateDispatchExceptionDto,
  ) {
    return this.routeRuns.resolveException(exceptionId, req.user, body.status || 'RESOLVED');
  }
}
