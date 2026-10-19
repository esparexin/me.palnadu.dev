import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AdminAuthModule} from '../auth/admin.module.js';
import {ExperienceController} from './experience.controller.js';
import {ExperienceService} from './experience.service.js';

/**
 * One module per domain collection (ARCHITECTURE.md section 5).
 *
 * `AdminAuthModule` is imported for the audit recorder the controller depends on.
 * The boundary stays one-way: a domain module consumes administration identity, it
 * does not reach into the admin application (ARCHITECTURE.md section 3).
 */
@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [ExperienceController],
  providers: [ExperienceService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
