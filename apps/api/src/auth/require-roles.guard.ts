import {Inject, Injectable, type CanActivate, type ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {ApiError} from '../common/api-error.js';
import {ROLES_KEY} from './require-roles.decorator.js';
import type {RequestWithAdmin} from './admin-context.js';

/**
 * Role enforcement, evaluated against the database-resolved role.
 *
 * This guard runs after `AdminSessionGuard`, so `request.admin` is present. If it is
 * not, the request reached the role check without authentication, which is a wiring
 * error rather than a client error: fail closed with 401 rather than assuming a role.
 */
@Injectable()
export class RequireRolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const admin = request.admin;
    if (admin === undefined) {
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }
    if (!required.includes(admin.role)) {
      throw new ApiError('FORBIDDEN', 'This account may not perform that action.');
    }
    return true;
  }
}
