import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';

@Controller('stream-route')
export class StreamController {
  @Get()
  @Public()
  streamRoute(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      })}\n\n`,
    );

    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      res.end();
    });
  }
}
