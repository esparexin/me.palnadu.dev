import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AdminService} from './admin.service.js';
import {AdminAuthController} from './admin-auth.controller.js';

/**
 * Administration identity for the API.
 *
 * The sign-in flow lives in apps/admin (Phase 6C). This module is the API half only:
 * it resolves a session to an administrator and records audit entries.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminAuthController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminAuthModule {}
