import {SetMetadata, type CustomDecorator} from '@nestjs/common';

/**
 * Marks a route as reachable without an administrator session.
 *
 * The guard is registered globally and fails closed, so a route is protected unless
 * it carries this decorator. Forgetting the annotation yields a 401; adding it
 * unnecessarily yields a test failure, because the e2e and integration suites assert
 * that every public route is deliberate.
 */
export const IS_PUBLIC_KEY = 'auth:public';
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
