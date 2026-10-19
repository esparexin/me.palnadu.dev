import {SetMetadata, type CustomDecorator} from '@nestjs/common';
import type {Role} from '@me-palnadu/contracts';

/**
 * Restricts a route to the listed roles.
 *
 * The role that is checked is always the one read from the database during
 * authentication, never the one in the token. A forged `role` claim therefore changes
 * nothing: the claim is parsed, shape-checked, and then discarded.
 */
export const ROLES_KEY = 'auth:roles';
export const RequireRoles = (...roles: readonly Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
