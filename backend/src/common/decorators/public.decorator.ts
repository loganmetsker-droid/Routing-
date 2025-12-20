import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public decorator to bypass JWT authentication
 * Use this on controllers/routes that should be accessible without authentication
 *
 * @example
 * @Public()
 * @Get('login')
 * login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
