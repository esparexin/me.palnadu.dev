import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AdminAuthModule} from '../auth/admin.module.js';
import {RevalidationModule} from '../revalidation/revalidation.module.js';
import {KnowledgeAdminController, KnowledgePublicController} from './knowledge.controller.js';
import {KnowledgeService} from './knowledge.service.js';

/** Public reads and authenticated authoring for the Knowledge Hub (ADR-0010). */
@Module({
  imports: [PrismaModule, AdminAuthModule, RevalidationModule],
  controllers: [KnowledgePublicController, KnowledgeAdminController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
