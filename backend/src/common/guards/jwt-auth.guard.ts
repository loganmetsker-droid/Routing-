import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard
 * Protects routes by requiring valid JWT token
 * Can be bypassed with @Public() decorator
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext) {
    // Handle both REST and GraphQL contexts
    const contextType = context.getType<string>();

    if (contextType === 'http') {
      return context.switchToHttp().getRequest();
    }

    // GraphQL context
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  handleRequest(err: any, user: any, info: any) {
    // Throw an exception if user is not found or error occurred
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'You must be logged in to access this resource',
        )
      );
    }
    return user;
  }
}
