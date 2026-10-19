import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AdminAuthModule} from '../auth/admin.module.js';
import {RevalidationModule} from '../revalidation/revalidation.module.js';
import {FaqAdminController, FaqPublicController} from './faq.controller.js';
import {FaqService} from './faq.service.js';

/** Public FAQ reads and authenticated authoring (ADR-0010). */
@Module({
  imports: [PrismaModule, AdminAuthModule, RevalidationModule],
  controllers: [FaqPublicController, FaqAdminController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
