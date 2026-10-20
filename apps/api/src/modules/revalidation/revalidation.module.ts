import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {RevalidationService} from './revalidation.service.js';

/** Cache invalidation, imported by every content module that publishes. */
@Module({
  imports: [PrismaModule],
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
